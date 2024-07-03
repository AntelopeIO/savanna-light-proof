# Savanna Lightproof

This is a proof-of-concept implementation of Savanna Lightproof, a proof server for the Antelope Savanna consensus.

Savanna Lightproof provides developers with a simple interface for generating proofs of block finality and proofs of block and action inclusion for blockchains running Antelope Spring.

At this stage, this proof-of-concept is not production-ready, but is sufficient to demonstrate IBC communications in the context of the Savanna consensus algorithm.

This is work-in-progress :

## To-do list :

- Implement final data structure and data persistence
- Implement data pruning
- Add snapshot support
- Add action proofs
- Add support for finalizer policy sunset
- Add finality proof generation
- Add supporting tools for IBC transaction lifecycle management

## Installation

```bash
git clone <repo>
cd <repo>
npm install
```

## Configuration

Copy config.jsonc.example to config.jsonc and edit file:

```json
{
    "network": "EOS Mainnet",
    "api_endpoint": "http://127.0.0.1:8888",
    "ship_endpoint": "ws://127.0.0.1:8080"
}
```

## Running the Server

```bash
npm run start
```

## Usage

See client/client.js for usage examples
