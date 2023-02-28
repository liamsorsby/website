---
title: Percona XtraDB - pt-online-schema-change notes / finds
date: '2023-01-05'
lastmod: '2023-02-28'
tags: ['technology', 'mysql', 'percona', 'sql']
draft: false
summary: 'Notes on usage and findings when using pt-online-schema-change'
---

# Percona XtraDB - pt-online-schema-change

## Summary

Percona XtraDB cluster is a database cluster that consists of multiple nodes.
Each node contains the same datasets which is syncronised across the nodes.
These nodes are normally configured with a minimum of 3 nodes, although you can configure 2 nodes,
as it uses leadership election to maintain quorum.

#### Advantages

- Providing the cluster can maintain quorum, you can lose nodes and continue without any customer impact.
- When you execute a query, it is executed locally on the node. All data is available locally, no need for remote access.
- A good solution for scaling a read heavy workload. You can send read queries to any of the nodes.

#### Drawbacks

- Provisioning new nodes require a full copy of the dataset. If your node is 50GB, you'll need to transfer 50GB over the network.
- It's not great with write heavy workloads. Percona uses a optimistic locking mechanism as opposed to the traditional pessimistic locking mechanism.
  - With an optimistic locking mechanism, percona will start a transaction, write the row then communicate out to other nodes. If any other node has made a change then it will rollback the change and return a deadlock.
  - A pessimistic locking mechanism will lock the row prior to writing ensuring that the row is written.
  - With this, it's advisable to ensure that you send your writes to a single node (programmatically) to try to avoid deadlocks / retries.

## Percona online schema change

#### Summary

When it comes to maintaining our database tables while we're serving customer traffic, we have to be careful around what commands we run to ensure that we don't lock our tables.
For example:

If we have the following SQL Table in the test database.

```mysql
CREATE TABLE `test`.`persons` (
    `personID` int(5) COLLATE utf8mb4_unicode_ci NOT NULL,
    `lastName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `city` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

Adding a new column will lock the table until the operation is complete. If this table has a small dataset (i.e less than 1000 rows) this isn't too problematic, providing the application code handles deadlocks gracefully as impact will be sub second.
If however, we have 500 million rows of data in this table we're going to run into some issues. This is where the percona toolset comes in.

The pt-online-schema-change tool is designed to emulate how MySQL creates tables internally, however it does this on a copy of the table you're wanting to change.
It will then setup triggers to ensure that while it's copying the data over any inserts, updates and deletes are also sent over to the new table.
When the data is finally copied over, pt-online-schema-change will move the table over in place of the old table, remove the triggers and remove the old table (by default it will, this can be disabled).
Note: These triggers then become part of the transaction, if the insert succeeds on the new table but the fails

on the second table for any reason, the transaction fails and it is rolledback.

Using the above table as an example and adding in a new column called firstName as a varchar(255) we'd want to run the following command.

```bash
pt-online-schema-change --alter "ADD COLUMN firstName varchar(255)" D=test,t=persons --dry-run --print
```

This command is using the --dry-run option, so it will provide us with some details around what it's actually going to do.

```mysql
Operation, tries, wait:
  analyze_table, 10, 1
  copy_rows, 10, 0.25
  create_triggers, 10, 1
  drop_triggers, 10, 1
  swap_tables, 10, 1
  update_foreign_keys, 10, 1
Starting a dry run.  `test`.`persons` will not be altered.  Specify --execute instead of --dry-run to alter the table.
Creating new table...
CREATE TABLE `test`.`_persons_new` (
  `personID` int(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
Created new table test._persons_new OK.
Altering new table...
ALTER TABLE `test`.`_persons_new` ADD COLUMN firstName varchar(255)
Altered `test`.`_persons_new` OK.
Not creating triggers because this is a dry run.
Not copying rows because this is a dry run.
INSERT LOW_PRIORITY IGNORE INTO `test`.`_persons_new` (`personID`, `lastName`, `address`, `city`) SELECT `personID`, `lastName`, `address`, `city` FROM `test`.`persons` LOCK IN SHARE MODE /*pt-online-schema-change 137703 copy table*/
Not swapping tables because this is a dry run.
Not dropping old table because this is a dry run.
Not dropping triggers because this is a dry run.
DROP TRIGGER IF EXISTS `test`.`pt_osc_test_persons_del`
DROP TRIGGER IF EXISTS `test`.`pt_osc_test_persons_upd`
DROP TRIGGER IF EXISTS `test`.`pt_osc_test_persons_ins`
2023-01-05T10:38:38 Dropping new table...
DROP TABLE IF EXISTS `test`.`_persons_new`;
2023-01-05T10:38:38 Dropped new table OK.
Dry run complete.  `test`.`persons` was not altered.
```

If we're happy with the above plan, we can execute the commands using the --execute command

```bash
pt-online-schema-change --alter "ADD COLUMN firstName varchar(255)" D=test,t=persons --execute --print
```

This can take a matter of seconds on small databases, but it can take up to a few hours if your datasets are quite large.

#### Update (28th Feb 2023)

I found that if you're converting an existing table. The code below will change the tables collation but _NOT_ the existing columns

```bash
pt-online-schema-change --alter "CHARACTER SET utf8mb4, COLLATE utf8mb4_bin;" D=test,t=persons --execute --print
```

If you're wanting to modify an existing table and upgrade the columns you'll want.

```bash
pt-online-schema-change --alter "CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;" D=test,t=persons --execute --print
```

#### References

[pt-online-schema-change documentation](https://docs.percona.com/percona-toolkit/pt-online-schema-change.html#usage)
