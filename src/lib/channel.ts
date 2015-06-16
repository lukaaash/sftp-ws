export interface IChannel {
    on(event: string, listener: Function): IChannel;
    send(packet: NodeBuffer): void;
    close(reason?: number, description?: string): void;
}
