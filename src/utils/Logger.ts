export class Logger {
    static info(message: string) {
        console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
    }
    
    static error(message: string, error?: any) {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
        if (error) console.error(error);
    }
    
    static debug(message: string) {
        if (process.env.DEBUG) {
            console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`);
        }