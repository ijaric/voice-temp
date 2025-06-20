import { ConnectionService, MessageHandlerContext, Connection } from '../../connection-manager';
export declare class MessageHandler {
    private connectionService;
    constructor(connectionService: ConnectionService);
    handleMessage(context: MessageHandlerContext): Promise<void>;
    handleConnection(connection: Connection): Promise<void>;
    handleDisconnection(connection: Connection): Promise<void>;
    private handleTestAudioRequest;
    private handleTextMessage;
    private handleEcho;
    private getTestAudioFromFile;
    private generateTestAudio;
}
//# sourceMappingURL=MessageHandler.d.ts.map