import api = require("./fs-api");
import misc = require("./fs-misc");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import isFile = misc.isFile;
import isDirectory = misc.isDirectory;
import readdir = misc.readdir;

interface IItemExt extends IItem {
    path?: string;
}

interface IDirInfo {
    path: string;
    pattern: number;
}

export function search(fs: IFilesystem, path: string, callback: (err: Error, items?: IItemExt[]) => void): void {

    // on windows, normalize backslashes
    var windows = process.platform == "win32";
    if (windows)
        path = path.replace(/\\/g, "/");

    // append a wildcard to slash-ended paths
    if (path[path.length - 1] == '/') path += "*";

    // resulting item list
    var results = <IItemExt[]>[];

    // important variables
    var basePath: string;
    var glob: RegExp;
    var queue = <IDirInfo[]>[];
    var patterns = <RegExp[]>[];

    // search for the first wildcard
    var w1 = path.indexOf('*');
    var w2 = path.indexOf('?');
    var w = (w1 < 0) ? w2 : (w2 < 0) ? w1 : w2;

    if (w >= 0) {
        // wildcard present -> split the path into base path and mask
        w = path.lastIndexOf('/', w);
        var mask = path.substr(w + 1);
        path = path.substr(0, w);

        // start matching
        start(path, mask);
    } else {
        // no wildcards -> determine whether this is a file or directory
        fs.stat(path,(err, stats) => {
            if (err) return callback(err, null);

            try {
                if (isDirectory(stats)) {
                    // if it's a directory, start matching
                    start(path, "*");
                } else {
                    if (isFile(stats)) {
                        // if it's a file, add it to the results
                        w = path.lastIndexOf('/');
                        var name = (w < 0) ? path : path.substr(0, w + 1);
                        results.push({ filename: name, path: path, stats: stats });
                    }

                    // and we are done
                    return callback(null, results);
                }
            } catch (err) {
                return callback(err, null);
            }
        });
    }

    return;

    // prepare and start the matching
    function start(path: string, mask: string): void {
        basePath = path;
        mask = "/" + mask;

        // determine glob mask (if any)
        var gs = mask.indexOf("/**");
        var globmask = null;
        if (gs >= 0) {
            if (gs == (mask.length - 3)) {
                globmask = "*";
                mask = mask.substr(0, gs);
            } else if (mask[gs + 3] == '/') {
                globmask = mask.substr(gs + 4);
                mask = mask.substr(0, gs);
            }
        }

        var masks = mask.split('/');

        for (var i = 1; i < masks.length; i++) {
            var mask = masks[i];
            var regex = toRegExp(mask, false);
            patterns.push(regex);
        }

        if (globmask != null) {
            patterns.push(null);
            glob = toRegExp(globmask, true);
        }

        // add path to queue and process it
        queue.push({ path: "", pattern: 0 });
        next();
    }

    // process next directory in the queue
    function next() {
        // get next directory to traverse
        var current = queue.shift();

        // if no more to process, we are done
        if (!current) return callback(null, results);

        // prepare vars
        var path = current.path;
        var index = current.pattern;
        var regex = patterns[index];

        var nextIndex;
        var matchFiles;
        var matchDirs;
        if (regex) {
            //console.log("Matching (r): ", basePath, path, regex.source);
            nextIndex = index + 1;
            var isLast = (nextIndex == patterns.length);
            matchFiles = isLast && glob == null;
            matchDirs = !isLast;
        } else {
            //console.log("Matching (g): ", basePath, path, glob.source);
            nextIndex = index;
            matchFiles = true;
            matchDirs = true;
        }

        // list directory and process its items
        readdir(fs, basePath + path,(err, items) => {
            if (err) return callback(err, null);

            try {
                items.forEach(item => {
                    var matchDir = matchDirs && (isDirectory(item.stats));
                    var matchFile = matchFiles && (isFile(item.stats));
                    if (!matchFile && !matchDir)
                        return;

                    var itemPath = path + "/" + item.filename;

                    var isMatch;
                    if (regex) {
                        // mask matching
                        isMatch = regex.test(item.filename);
                    } else {
                        // globstar matching
                        isMatch = matchDir || glob.test(path + item.filename);
                    }

                    if (!isMatch)
                        return;

                    if (matchFile) {
                        // add matched file to the list
                        (<IItemExt>item).path = itemPath;
                        results.push(item);
                    } else if (matchDir) {
                        // add matched directory to queue
                        queue.push({ path: itemPath, pattern: nextIndex });
                    }
                });

                next();
            } catch (err) {
                return callback(err, null);
            }
        });
    }

    // convert mask pattern to regular expression
    function toRegExp(mask: string, globstar: boolean): RegExp {
        var pattern = "^";
        if (globstar) pattern += ".*";
        for (var i = 0; i < mask.length; i++) {
            var c = mask[i];
            switch (c) {
                case '/':
                    var gm = mask.substr(i, 4);
                    if (gm == "/**/" || gm == "/**") {
                        pattern += ".*";
                        i += 3;
                    } else {
                        pattern += '/';
                    }
                    break;
                case '*':
                    if (globstar) {
                        pattern += "[^/]*";
                    } else {
                        pattern += ".*";
                    }
                    break;
                case '?':
                    pattern += ".";
                    break;
                default:
                    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                        pattern += c;
                    } else {
                        pattern += "\\" + c;
                    }
                    break;
            }
        }
        pattern += "$";

        // case insensitive on Windows
        var flags = windows ? "i" : "";

        return new RegExp(pattern, flags);
    }

}
