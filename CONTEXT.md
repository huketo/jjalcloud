# jjalcloud

Sharing animated images on the AT Protocol: people keep their own images in their own
repositories, and this service makes the network's images findable.

## Language

### The things people make

**GIF**:
A record in a person's repository declaring an animated image and the metadata that describes it. The unit this service exists to share.
_Avoid_: post, image, meme, 짤

**Like**:
A record in a person's repository pointing at a GIF by strong reference — i.e. bound to that exact version of it.
_Avoid_: favourite, star, heart, reaction

**Blob**:
The binary body of a GIF. It lives on its author's PDS and is referenced from the GIF by content address. This service never holds one.
_Avoid_: file, upload, asset, attachment

### The network

**Repository**:
The signed, append-only record store a person owns. The only authority on what that person has published.
_Avoid_: account data, user data, profile

**PDS**:
The server hosting a person's repository and serving their blobs. Any PDS on the network, not one particular one.
_Avoid_: server, host, backend, instance

**Handle**:
The human-readable name that points at a DID. It can change, and it can be pointed somewhere else; the DID cannot.
_Avoid_: username, name, id

**Lexicon**:
The schema defining one of this project's record or query types, identified by its NSID. What makes a GIF written by another client still a GIF.
_Avoid_: schema, type, model, contract

### This service

**AppView**:
The aggregating half of this service: it answers queries about records from across the network. Anyone's client may call it, not only this project's website.
_Avoid_: API, backend, server

**Index**:
The derived copy of network records the AppView queries. Reconstructible from PDSes at any time, and therefore never a source of truth.
_Avoid_: database, cache, store, mirror

**Ingest**:
The path carrying records from the network into the Index, and the only writer to it.
_Avoid_: sync, importer, pipeline, worker

**Adopted repository**:
A repository the Ingest tracks. A repository is adopted because it was seen writing one of this project's Lexicons — not because its owner signed up here.
_Avoid_: subscribed user, member, registered user

**Backfill**:
Reading an Adopted repository's existing records from its PDS, rather than receiving them as they happen.
_Avoid_: import, catch-up, historical sync
