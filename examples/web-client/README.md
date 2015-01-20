# SFTP over WebSockets - browser-based client and Node.js server

This sample consists of two independent parts:

1. A very simply *SFTP over WebSockets* server for Node.js using sftp-ws and Express.
2. A proof-of-concept browser based SFTP client in JavaScript that makes it possible to connect to an "SFTP over WebSockets" servers, upload files and display images.

The browser-based client is actually a bit of a hack at the moment - it is built on top of mscdex's SFTP module for Node.js, which is only possible by simulating a Node.js like environment
in a rather nasty way. I know... I could have used [Browserify](http://browserify.org/). But my final goal is the creation of an *ordinary* browser-based SFTP client library, so there was no need for that.

The client could be used stand-alone to connect to other servers, possibly even running at different servers. WebSockets are not limited by the same-origin policy. However, there are currently no third-party SFTP servers with WebSockets support.

Please note that this is a proof-of-concept code. Using it in custom projects is not recommended yet at all. Its main purpose is to demonstrate that using SFTP over WebSockets in web browsers is perfectly possible.

The SFTPv3.js and Stats.js files come from https://github.com/mscdex/ssh2:
	https://raw.githubusercontent.com/mscdex/ssh2/2603c4dc80cff50f5306dead43aa3a582b5974a2/lib/SFTP/SFTPv3.js
	https://raw.githubusercontent.com/mscdex/ssh2/ea24a70dc07d2cbd96d74c5e6405ad3d26a7b332/lib/SFTP/Stats.js

The Buffer.js file comes from https://github.com/toots/buffer-browserify/:
	https://raw.githubusercontent.com/toots/buffer-browserify/b83fb3502430cbb596370b13033b1fe625ce2434/index.js

