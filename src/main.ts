/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/ws/ws.d.ts" />
/// <reference path="lib/sftp.ts" />

process.argv.push("tests"); require("./node_modules/mocha/bin/_mocha"); // run tests



