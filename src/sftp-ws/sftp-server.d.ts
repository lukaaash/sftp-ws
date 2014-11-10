/// <reference path="sftp-packet.d.ts" />
/// <reference path="sftp-misc.d.ts" />
import packet = require("./sftp-packet");
export declare class SftpServer {
    private handles;
    private send;
    constructor(send: (reply: packet.SftpPacket) => void);
    private addHandle(path);
    private removeHandle(h);
    private getHandle(h);
    private getHandleFd(handle, packet, requestId);
    private success(packet, requestId);
    private status(packet, requestId, code, message);
    private checkError(err, requestId, packet);
    private finish(packet, requestId, err);
    private stats(packet, requestId, err, stats);
    private canonizalice(path);
    private localize(path);
    public process(request: NodeBuffer): void;
}
