import winston = require("winston");
import fs from 'fs';
import { SimpleDate, Time } from "../../api/types";

const listSubDirectories = (path:string) => {
    return fs.readdirSync(path).filter(file => {
        return fs.statSync(path + "/" + file).isDirectory()
    });
}

const isValidDate = (year:number, month:number, day:number) => {
    const tempDate = new Date(year, --month, day);
    return month === tempDate.getMonth();   
}

// Parses subdirectories as time slices based on format YYYY-MM-DD
export const timeSlices = (tileDir:string) => {
    const slices = new Map<SimpleDate,string>();
    const subdirectories = listSubDirectories(tileDir);
    subdirectories.forEach(subdir => {
        console.log("Subdir is " + subdir);
        let yr:number, m:number, d:number;
        const parts = subdir.split('-');
        if (parts.length > 3) return;
        if (!isNaN(Number(parts[0]))) {
            yr = Number(parts[0]);
        } else return;
        if (parts.length == 1) {
            slices.set({ Year: yr }, tileDir+'/'+subdir);
        }
        if (!isNaN(Number(parts[1]))) {
            if (Number(parts[1]) > 0 && Number(parts[1]) < 13) { m = Number(parts[1]); }
            else return;
        } else return;
        if (parts.length == 2) {
            slices.set({ Year: yr, Month: m }, tileDir+'/'+subdir);
        }
        if (!isNaN(Number(parts[2]))) {
            d = Number(parts[2]);
            if (isValidDate(yr,m,d)) {
                slices.set({ Year: yr, Month: m, Day: d }, tileDir+'/'+subdir);
            } 
        }
    });
    winston.debug("Time slices: " + JSON.stringify(slices));
    return slices;
}

// Find a matching filename given temporal slices and a time mode.
export const temporalMatch = (slices:Map<SimpleDate, string>,t: Time) => {
    switch (t.kind) {
        case "exact": return {Date: t.date, Slice: slices.get(t.date) };
        case "latest": 
            const latest =
                Array.from(slices.keys())
                //.sort((a, b) => a.Month - b.Month)
                .sort((a, b) => a.Year - b.Year).pop();
            if (latest != null) {
                return { Date: latest, Slice: slices.get(latest) };
            } else return undefined;
        case "before": 
            const before = 
                Array.from(slices.keys())
                .filter(x => x.Year <= t.date.Year)
                // .filter(x.Month <= t.date.Month && x.Day <= t.date.Day) // TODO Check nulls
                // .sort((a, b) => a.Day - b.Day)
                // .sort((a, b) => a.Month - b.Month)
                .sort((a, b) => a.Year - b.Year).pop();
            if (before != null) {
                return {Date: before, Slice: slices.get(before) };
            } else return undefined;
    }
}
