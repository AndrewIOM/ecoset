import child from 'child_process';
import { logger } from '../../api/logger';

export function runCommand(
    command:string, 
    opts:any, 
    suppressStdout:boolean, 
    suppressStderr:boolean)  : Promise<string>
{
    logger.info("Running command: \"" + command + " " + opts.join(" ") + "\", suppressing STDOUT: " + suppressStdout + " suppressing STDERR: " + suppressStderr);

    let promise : Promise<string> = new Promise((resolve, reject) => {
        let output = "";
        const exec = child.spawn(command, opts);
        
        exec.stderr.on("data", data => {
            if(!suppressStderr) logger.error(data.toString());
        })
        exec.stdout.on("data", data => {
            output += data;
            if(!suppressStdout) logger.info("[" + command + " " + opts.join(" ") + "]: " + data.toString());
        })
        exec.on("close", code => {
            if (code != 0) {
                logger.warn("Process ended with non-zero code: " + command);
                return reject("Process ended with non-zero code: " + command);
            }
            return resolve(output);
        });
    });

    return promise;
}