import api = require("./fs-api");
import misc = require("./fs-misc");

import IFilesystem = api.IFilesystem;
import IStats = api.IStats;
import IItem = api.IItem;
import FileUtil = misc.FileUtil;
import Path = misc.Path;

interface IItemExt extends IItem {
    path: string;
    relativePath: string;
}

interface IDirInfo {
    path: string;
    pattern: number;
}

interface IEventEmitter {
    emit(event: string, ...args: any[]): boolean;
}

interface ISearchOptions {
    skipDirectories?: boolean;
}

export function search(fs: IFilesystem, path: string, emitter: IEventEmitter, options: ISearchOptions, callback: (err: Error, items?: IItemExt[]) => void): void {

    if (path.length == 0)
        throw new Error("Empty path");

    // on windows, normalize backslashes
    var windows = (<any>fs).isWindows == true;
    path = new Path(path).normalize(windows).toString();

    // append a wildcard to slash-ended paths
    if (path[path.length - 1] == '/') path += "*";

    // resulting item list
    var results = <IItemExt[]>[];

    // important variables
    var basePath: string;
    var matchDirectories = (!options || !options.skipDirectories);
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
        if (w >= 0)
            path = path.substr(0, w);
        else
            path = ".";

        // start matching
        start(path, mask);
    } else {
        // no wildcards -> determine whether this is a file or directory
        fs.stat(path,(err, stats) => {
            if (err) return callback(err, null);

            try {
                if (FileUtil.isDirectory(stats)) {
                    // if it's a directory, start matching
                    start(path, "*");
                } else {
                    if (FileUtil.isFile(stats)) {
                        // if it's a file, add it to the results
                        w = path.lastIndexOf('/');
                        var name;
                        if (w < 0) {
                            name = path;
                            path = "./" + name;
                        } else {
                            name = path.substr(w + 1);
                        }
                        results.push({ filename: name, path: path, relativePath: name, stats: stats });
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
                matchDirectories = matchDirectories && (globmask.lastIndexOf("/**") == (globmask.length - 3));
            }
        } else {
            matchDirectories = false;
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
        if (!current) {
            return callback(null, results);
        }

        var path: string;
        var index: number;
        var regex: RegExp;

        var nextIndex;
        var matchFiles;
        var matchDirs;

        try {
            // prepare vars
            path = current.path;
            index = current.pattern;
            regex = patterns[index];

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

            var fullPath = basePath + path;

            // list directory and process its items
            fs.opendir(fullPath,(err, handle) => {
                if (err) return callback(err, null);

                emitter.emit("traversing", fullPath);

                // send 1 read request
                var error = null;
                var requests = 1;
                fs.readdir(handle, read);

                function read(err: Error, items: IItem[]|boolean): void {
                    try {
                        requests--;
                        error = error || err;
                        if (error || !items) {
                            if (requests > 0) return;

                            // when done, close the handle
                            fs.close(handle, err => {
                                error = error || err;
                                if (err) return callback(error, null);

                                emitter.emit("traversed", fullPath);

                                // process next directory
                                next();
                            });
                            return;
                        }

                        // process items
                        (<IItemExt[]>items).forEach(process);

                        // read next items using several parallel readdir requests
                        while (requests < 2) {
                            fs.readdir(handle, read);
                            requests++;
                        }
                    } catch (err) {
                        error = error || err;
                        return callback(error, null);
                    }
                }
            });
        } catch (err) {
            return callback(err, null);
        }

        // process a single item
        function process(item: IItemExt): void {
            var isMatchedDir = matchDirs && (FileUtil.isDirectory(item.stats));
            var isMatchedFile = matchFiles && (FileUtil.isFile(item.stats));
            if (!isMatchedFile && !isMatchedDir) return;

            var itemPath = path + "/" + item.filename;

            if (regex) {
                // mask matching
                if (!regex.test(item.filename)) return;
            } else {
                // globstar matching
                if (isMatchedFile || matchDirectories) isMatchedFile = glob.test(path + item.filename);
            }

            if (isMatchedFile) {
                // add matched file to the list
                item.path = basePath + itemPath;
                item.relativePath = itemPath.substr(1);
                results.push(item);
                emitter.emit("item", item);
            }

            if (isMatchedDir) {
                // add matched directory to queue
                queue.push({ path: itemPath, pattern: nextIndex });
            }
        }        
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
