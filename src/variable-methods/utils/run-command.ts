import winston = require("winston");
import child from 'child_process';

export function runCommand(
    command:string, 
    opts:any, 
    suppressStdout:boolean, 
    suppressStderr:boolean)  : Promise<string>
{
    winston.info("Running command: \"" + command + " " + opts.join(" ") + "\", suppressing STDOUT: " + suppressStdout + " suppressing STDERR: " + suppressStderr);

    let promise : Promise<string> = new Promise((resolve, reject) => {
        let output = "";
        const exec = child.spawn(command, opts);
        
        exec.stderr.on("data", data => {
            if(!suppressStderr) winston.error(data.toString());
        })
        exec.stdout.on("data", data => {
            output += data;
            if(!suppressStdout) winston.info("[" + command + " " + opts.join(" ") + "]: " + data.toString());
        })
        exec.on("close", code => {
            if (output.length == 0) console.log("Command did not log output: " + command + opts.toString());
            if (code != 0) {
                winston.warn("Process ended with non-zero code: " + command);
                return reject("Process ended with non-zero code: " + command);
            }
            return resolve(output);
        });
    });

    return promise;
}