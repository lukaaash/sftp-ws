# SFTP over WebSockets - browser-based client and Node.js server

This sample consists of two independent parts:

1. A very simply *SFTP over WebSockets* server for Node.js using sftp-ws and Express.
2. A proof-of-concept browser based SFTP client in JavaScript that makes it possible to connect to an "SFTP over WebSockets" servers, upload files and display images.

The client can be used stand-alone to connect to other servers, possibly even running at different servers. WebSockets are not limited by the same-origin policy. However, there are currently no third-party SFTP servers with WebSockets support.
