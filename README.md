# bot-remote

Run command on distant bot(s)

## Usage

```
Usage: remote [options] [user] [command...]

  Run command on distant bot(s)

  Options:

    --help              output usage information
    -l, --list          List all peers
    -w, --whois <name>  Show peers with this name
```

## Config (config.yaml)

```yaml
remote:
  username: john_doe
  room: room_name
```

## Installation

You have to install `node-gyp` which will recompile some dependencies when retrieving the `ipfs` dependency.

### Windows TLDR;

In a powershell console with admin rights

```
npm install --global --production windows-build-tools
npm install -g node-gyp
```

### More details

See https://github.com/nodejs/node-gyp
