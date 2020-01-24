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
        const exec =
            child.spawn(command, opts)
                .on("exit", code => {
                    return resolve(output);
                });
        
        exec.stderr.on("data", data => {
            if(!suppressStderr) winston.error(data.toString());
        })
        exec.stdout.on("data", data => {
            output += data
            if(!suppressStdout) winston.info("[" + command + " " + opts.join(" ") + "]: " + data.toString());
        })
    });

    return promise;
}