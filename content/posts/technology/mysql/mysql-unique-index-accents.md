---
title: MySQL - Why using the right collation is important.
date: '2023-01-11'
tags: ['technology', 'mysql', 'collation', 'sql']
draft: false
summary: 'A recent encounter with a unique index rejecting two different string values.'
---

This post uses MySQL 5.7 (Percona XtraDB Cluster 5.7).

## Overview

Recently, we encountered an unusual bug which caused an application to throw a `Duplicate entry` error on a unique index containing non-identical values.
This error, as you may have guessed, was due to the collation we used.

## Setup

Using the following example we can replicate the behaviour

```yaml
version: '3.9'
services:
  percona-xtradb-cluster:
    container_name: pxc_node
    image: 'percona/percona-xtradb-cluster:5.7'
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - CLUSTER_NAME=pxc-cluster
    ports:
      - '3306:3306'
      - '4567:4567'
      - '4568:4568'
      - '4444:4444'
    volumes:
      - pxc1:/var/lib/mysql
      - './scripts/:/docker-entrypoint-initdb.d/'
    healthcheck:
      test: 'mysql -uroot -proot --execute="SHOW STATUS LIKE ''wsrep_connected'';" | grep -i ON'
      start_period: 5s
      interval: 5s
      timeout: 5s
      retries: 55
    networks:
      - pxc-network

  percona-xtradb-server1:
    depends_on:
      percona-xtradb-cluster:
        condition: service_healthy
    container_name: pxc_node1
    image: 'percona/percona-xtradb-cluster:5.7'
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - CLUSTER_NAME=pxc-cluster
      - CLUSTER_JOIN=pxc_node
    volumes:
      - pxc2:/var/lib/mysql
    networks:
      - pxc-network

  percona-xtradb-server2:
    depends_on:
      percona-xtradb-cluster:
        condition: service_healthy
    container_name: pxc_node2
    image: 'percona/percona-xtradb-cluster:5.7'
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - CLUSTER_NAME=pxc-cluster
      - CLUSTER_JOIN=pxc_node
    volumes:
      - pxc3:/var/lib/mysql
    networks:
      - pxc-network
volumes:
  pxc1:
  pxc2:
  pxc3:
networks:
  pxc-network:
```

The above docker-compose file allows us to set up a fresh Percona cluster whilst ensuring that the primary node connects first.
This prevents us from hitting bootstrap issues by utilising the healthcheck feature. Each node has its own data volume; nodes must never share a data directory.

We're also binding some initial SQL statements to set things up:

```sql
-- ./scripts/1.sql
SET collation_connection     = 'utf8mb4_unicode_ci';
SET collation_database       = 'utf8mb4_unicode_ci';
SET collation_server         = 'utf8mb4_unicode_ci';
SET character_set_results    = 'utf8mb4';
SET character_set_client     = 'utf8mb4';
SET character_set_filesystem = 'utf8mb4';

DROP DATABASE if exists test_db;
CREATE DATABASE test_db;

drop table if exists test_db.utf8_test;
CREATE TABLE test_db.utf8_test
(
    id   int(20) unsigned not null auto_increment,
    name varchar(255) default null,
    primary key (id),
    unique key idx_name (name)
) engine=innodb default charset=utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Replicating the problem

To replicate the issue we can run the following commands

```bash
docker exec -it pxc_node mysql -uroot -proot
```

```sql
insert into test_db.utf8_test (name) values ('áááá');
insert into test_db.utf8_test (name) values ('aaaa');
```

You should then see MySQL return a duplicate entry error `ERROR 1062 (23000): Duplicate entry 'aaaa' for key 'idx_name'`.

This is because `utf8mb4_unicode_ci` and `utf8mb4_general_ci` are accent-insensitive (and case-insensitive), so `abád`, `abad` and `ABAD` all compare as equal.
To avoid this you can use the `utf8mb4_bin` collation instead. It compares the raw bytes of each character, so accents _and_ case are significant (`abad` and `ABAD` become different values too).

```sql
SET collation_connection = 'utf8mb4_bin';
SET collation_database   = 'utf8mb4_bin';
SET collation_server     = 'utf8mb4_bin';
drop table if exists test_db.utf8_test;
CREATE TABLE test_db.utf8_test
(
    id   int(20) unsigned not null auto_increment,
    name varchar(255) default null,
    primary key (id),
    unique key idx_name (name)
) engine=innodb default charset=utf8mb4 COLLATE utf8mb4_bin;
```

Running the inserts again now insert the rows as expected.

```text
mysql> insert into test_db.utf8_test (name) values ('áááá');
Query OK, 1 row affected (0.02 sec)

mysql> insert into test_db.utf8_test (name) values ('aaaa');
Query OK, 1 row affected (0.00 sec)

mysql> SELECT * FROM test_db.utf8_test;
+----+----------+
| id | name     |
+----+----------+
|  1 | áááá     |
|  2 | aaaa     |
+----+----------+
2 rows in set (0.00 sec)
```

## Summary

If you need to accept both `abc` and `ábc` as distinct unique values, don't use `utf8mb4_unicode_ci` or `utf8mb4_general_ci`; use `utf8mb4_bin` instead (or, on MySQL 8.0+, an accent-sensitive collation such as `utf8mb4_0900_as_ci`).

Binary collations are also faster than `utf8mb4_unicode_ci` and `utf8mb4_general_ci`, as documented in the Percona blog post referenced below.

## References

- [Charset and Collation Settings Impact on MySQL Performance](https://www.percona.com/blog/2019/02/27/charset-and-collation-settings-impact-on-mysql-performance/)
