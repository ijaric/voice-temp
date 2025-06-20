import { Connection, ConnectionStats } from '../domain/models';
export interface IConnectionRepository {
    add(connection: Connection): void;
    remove(connectionId: string): boolean;
    get(connectionId: string): Connection | undefined;
    getAll(): Connection[];
    getActive(): Connection[];
    exists(connectionId: string): boolean;
    updateLastActivity(connectionId: string): void;
    getStats(): ConnectionStats;
    clear(): void;
}
export declare class ConnectionRepository implements IConnectionRepository {
    private connections;
    private startTime;
    add(connection: Connection): void;
    remove(connectionId: string): boolean;
    get(connectionId: string): Connection | undefined;
    getAll(): Connection[];
    getActive(): Connection[];
    exists(connectionId: string): boolean;
    updateLastActivity(connectionId: string): void;
    getStats(): ConnectionStats;
    clear(): void;
}
//# sourceMappingURL=ConnectionRepository.d.ts.map