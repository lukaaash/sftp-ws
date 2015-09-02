sftp-ws
=======

v0.3.0
------

SFTP over WebSockets - client and server library for Node.js.

## Overview

SFTP is a simple remote filesystem protocol misnamed as *SSH File Transfer Protocol*. This package provides SFTP v3, but layers it on top of WebSockets instead of SSH.
This makes it possible to run an SFTP client in any modern web browser.
Check out my [blogpost](http://lukas.pokorny.eu/sftp-over-websockets/) for more information.

This package is currently in development and has not been sufficiently tested yet.

## Installing

```shell
npm install --save sftp-ws
```

## API

The SFTP client provides a high-level API for multi-file operations, but it also aims to be compatible with SFTP client in [ssh2 module](https://github.com/mscdex/ssh2) by Brian White.

Einaros [ws module](https://github.com/einaros/ws) is used to handle WebSockets and this is reflected in parts of the client and server API as well.

### SFTP client - connecting to a server:

```javascript
var SFTP = require('sftp-ws');

// create an SFTP over WebSockets object
var client = new SFTP.Client();

// connect to a server
client.connect('ws://localhost/path');

// handle errors
client.on('error', function (err) {
    console.log('Error: %s', err.message);
});

// when connected, display a message and file listing
client.on('ready', function () {
    console.log('Connected to the server.');

    client.list('.').on('success', function (list) {
        
		// display the listing
		list.forEach(function (item) {
            return console.log(item.longname);
        });

		// close the connection
		client.end();
    });
});
```

### SFTP client - downloading files

```javascript

// initialize an SFTP client object here

// download all files matching the pattern
// (into the current local directory)
client.download('sftp-ws-*.tgz', '.');
```

### SFTP server - listening for connections:

```javascript
var SFTP = require('sftp-ws');

// start SFTP over WebSockets server
var server = new SFTP.Server({
    port: 3004,
    virtualRoot: '.',
    readOnly: true
});
```

### Examples

Sample code is available in [this project's GitHub repository](https://github.com/lukaaash/sftp-ws/tree/master/examples).

This includes a proof-of-concept version of a [browser-based SFTP/WS client](https://github.com/lukaaash/sftp-ws/tree/v0.3.0/examples/web-client).

## Virtual filesystems

This SFTP package is built around the `IFilesystem` interface:

```typescript
interface IFilesystem {
    open(path: string, flags: string, attrs?: IStats, callback?: (err: Error, handle: any) => any): void;
    close(handle: any, callback?: (err: Error) => any): void;
    read(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => any): void;
    write(handle: any, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error) => any): void;
    lstat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
    fstat(handle: any, callback?: (err: Error, attrs: IStats) => any): void;
    setstat(path: string, attrs: IStats, callback?: (err: Error) => any): void;
    fsetstat(handle: any, attrs: IStats, callback?: (err: Error) => any): void;
    opendir(path: string, callback?: (err: Error, handle: any) => any): void;
    readdir(handle: any, callback?: (err: Error, items: IItem[]|boolean) => any): void;
    unlink(path: string, callback?: (err: Error) => any): void;
    mkdir(path: string, attrs?: IStats, callback?: (err: Error) => any): void;
    rmdir(path: string, callback?: (err: Error) => any): void;
    realpath(path: string, callback?: (err: Error, resolvedPath: string) => any): void;
    stat(path: string, callback?: (err: Error, attrs: IStats) => any): void;
    rename(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
    readlink(path: string, callback?: (err: Error, linkString: string) => any): void;
    symlink(targetpath: string, linkpath: string, callback?: (err: Error) => any): void;
    link(oldPath: string, newPath: string, callback?: (err: Error) => any): void;
}

export interface IStats {
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number;
    atime?: Date;
    mtime?: Date;

    isFile? (): boolean;
    isDirectory? (): boolean;
    isSymbolicLink? (): boolean;
}

export interface IItem {
    filename: string;
    stats: IStats;

    longname?: string;
    path?: string;
}
```

The functions of `IFilesystem` interface represent actual SFTP protocol commands in a way that resembles the `fs` module that comes with Node.js.
The SFTP client object implements this interface (and other useful wrapper methods).
The SFTP server object makes instances of this interface accessible by clients.

This package comes with an implementation of 'virtual filesystem' that uses `fs` to make parts of the local filesystem accessible to SFTP clients.
However, you can easily implement a custom virtual filesystem and use it instead of the built-in one - just supply an instance of `IFilesystem` to SFTP server's constructor as `filesystem' option.

## Future

List of things I would like to add soon:

- More unit tests
- Better documentation
- Proper browser-based client
- Client-side wrapper around `IFilesystem` to simplify common tasks
- SFTP/WS to SFTP/SSH proxy
- Command-line SFTP/WS client utility