sftp-ws
=======

SFTP over WebSockets - client and server library for Node.js.

## Overview

SFTP is a simple remote filesystem protocol misnamed as *SSH File Transfer Protocol*. This package provides SFTP v3, but layers it on top of WebSockets instead of SSH.
This makes it possible to run an SFTP client in any modern web browser.
Check out my [blogpost](https://lukas.pokorny.eu/sftp-over-websockets/) for more information.

This package is currently in development and has not been sufficiently tested yet.

## Installing

To install from [npm](https://www.npmjs.com/package/sftp-ws):

```shell
npm install --save sftp-ws
```

## Changes

The API has been changed slightly in v0.7:
- SFTP client now features a dual Node.js-style and Promise-based API.
- IFilesystem API has been slightly modified. Arguments in `read` callback have been reversed, and `rename` method has been extended.

## API

The SFTP client provides a high-level API for multi-file operations, but it also aims to be compatible with SFTP client in [ssh2 module](https://github.com/mscdex/ssh2) by Brian White.

Einaros [ws module](https://github.com/einaros/ws) is used to provide WebSockets connectivity.

### Examples

Sample code is available in [this project's GitHub repository](https://github.com/lukaaash/sftp-ws/tree/master/examples).

Stand-alone [Browser-based SFTP/WS client](https://nuane.com/sftp.js) is available as well. Check out the [web client sample](https://github.com/lukaaash/sftp-ws/tree/master/examples/web-client) to see it in action.

### SFTP client - example (Node.js-style API):

```javascript
var SFTP = require("sftp-ws");

// url, credentials and options
var url = "ws://nuane.com/sftp";
var options = { username: "guest", password: "none" };

// connect to the server
var client = new SFTP.Client();
client.connect(url, options, function (err) {
    if (err) {
        // handle error
        console.log("Error: %s", err.message);
        return;
    }
    
    // display a message
    console.log("Connected to the server.");
    
    // retrieve directory listing
    client.list(".", function (err, list) {
        if (err) {
            // handle error
            console.log("Error: %s", err.message);
            return;
        }
        
        // display the listing
        list.forEach(function (item) {
            console.log(item.longname);
        });
        
        // disconnect
        client.end();
    });
});
```

### SFTP client - example (Promise-based API):

```javascript
var SFTP = require("sftp-ws");

// url, credentials and options
var url = "ws://nuane.com/sftp";
var options = {
    username: "guest",
    password: "none",
    promise: null // you can supply a custom Promise implementation
};

// connect to the server
var client = new SFTP.Client();
client.connect(url, options).then(function () {
    // display a message
    console.log("Connected to %s", url);
    
    // retrieve directory listing
    return client.list(".");

}).then(function (list) {
    // display the listing
    list.forEach(function (item) {
        console.log(item.longname);
    });

}).catch(function (err) {
    // handle errors
    console.log("Error: %s", err.message);

}).then(function () {
    // disconnect
    client.end();

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

## Virtual filesystems

This SFTP package is built around the `IFilesystem` interface:

```typescript
interface IFilesystem {
    open(path: string, flags: string, attrs: IStats, callback: (err: Error, handle: any) => any): void;
    close(handle: any, callback: (err: Error) => any): void;
    read(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback: (err: Error, buffer: Buffer, bytesRead: number) => any): void;
    write(handle: any, buffer: Buffer, offset: number, length: number, position: number, callback: (err: Error) => any): void;
    lstat(path: string, callback: (err: Error, attrs: IStats) => any): void;
    fstat(handle: any, callback: (err: Error, attrs: IStats) => any): void;
    setstat(path: string, attrs: IStats, callback: (err: Error) => any): void;
    fsetstat(handle: any, attrs: IStats, callback: (err: Error) => any): void;
    opendir(path: string, callback: (err: Error, handle: any) => any): void;
    readdir(handle: any, callback: (err: Error, items: IItem[]|boolean) => any): void;
    unlink(path: string, callback: (err: Error) => any): void;
    mkdir(path: string, attrs: IStats, callback: (err: Error) => any): void;
    rmdir(path: string, callback: (err: Error) => any): void;
    realpath(path: string, callback: (err: Error, resolvedPath: string) => any): void;
    stat(path: string, callback: (err: Error, attrs: IStats) => any): void;
    rename(oldPath: string, newPath: string, flags: RenameFlags, callback: (err: Error) => any): void;
    readlink(path: string, callback: (err: Error, linkString: string) => any): void;
    symlink(oldPath: string, newPath: string, callback: (err: Error) => any): void;
    link(oldPath: string, newPath: string, callback: (err: Error) => any): void;
}

interface IStats {
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

interface IItem {
    filename: string;
    stats: IStats;

    longname?: string;
    path?: string;
}

const enum RenameFlags {
    OVERWRITE = 1,
    //ATOMIC = 2,
    //NATIVE = 4,
}
```

The functions of `IFilesystem` interface represent SFTP protocol commands and resemble the `fs` module that comes with Node.js.
The SFTP client object implements this interface (and other useful wrapper methods).
The SFTP server object makes instances of this interface accessible by clients.

This package comes with an implementation of 'virtual filesystem' that uses `fs` to make parts of the local filesystem accessible to SFTP clients.
However, you can easily implement a custom virtual filesystem and use it instead of the built-in one - just supply an instance of `IFilesystem` to SFTP server's constructor as `filesystem' option.

## Future

List of things I would like to add soon:

- More powerful API
- More unit tests
- Even more unit tests
- Better documentation
- SFTP/WS to SFTP/SSH proxy
