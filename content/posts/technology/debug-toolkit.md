---
title: Building Debug Toolkit, a network toolbox for Android
date: '2026-11-02'
tags: ['technology', 'android', 'kotlin', 'jetpack-compose', 'networking', 'dns', 'tools']
draft: false
summary: 'Notes from building an Android app with ping, DNS, TLS and port tools, and what was fun about it.'
---

I got tired of reaching for a laptop every time I wanted to check something simple on a network. Is DNS wrong? Is that port open? When does that certificate expire? So I built an app for it: [Debug Toolkit](https://debug-toolkit.sorsby.co/). It's on [Google Play](https://play.google.com/store/apps/details?id=co.sorsby.debugtoolkit) and it's free.

It's Kotlin and Jetpack Compose, with Koin for dependency injection and OkHttp for the web bits. Most of the tools were quick to put together. A few were more fun than I expected.

## Ping, without the raw sockets

My first worry was ping. Android apps can't open raw ICMP sockets, so I figured I'd need some workaround. Turns out the OS already ships a `ping` binary that does the job, so the app just runs that and reads what comes back. Traceroute works the same way. It feels a bit like cheating, but it's the same tool the platform uses, and parsing its output is easy to test.

## Writing my own DNS client

This was my favourite part. Cloudflare's DNS-over-HTTPS covers most lookups, but I wanted to be able to ask a specific nameserver directly, and that meant speaking DNS myself.

It's a small binary protocol, which makes it more approachable than it sounds. You build a query, send it over UDP, and fall back to TCP if the answer is too big. Reading the response is the tricky bit, because names are compressed with pointers back into the message. I had to be careful there, since a dodgy response shouldn't be able to send the parser off the end of the buffer.

## Finding things on your network

The LAN scanner sweeps your subnet and checks which addresses answer. The one thing I was careful about was not hammering the network, so it only probes a limited number of hosts at a time. I also kept the scanning logic separate from Android itself, so I could test it on my laptop without a phone or a real network.

## Keeping it simple

Nothing runs in the background, and nothing is saved. You tap a tool, it does one job, and it shows you the result. That kept the code smaller and the app easier to trust.

If you try it and something's missing or wrong, tell me. I'm always happy to add another tool.
