import Promise from 'bluebird';
import loaderUtils from 'loader-utils';
import path from 'path';

const fs = Promise.promisifyAll(require('fs')); // eslint-disable-line import/no-commonjs

export default function writeFile(globalRef, pattern, file) {
    const {info, debug, compilation, fileDependencies, written, copyUnmodified} = globalRef;

    return fs.statAsync(file.absoluteFrom)
    .then((stat) => {
        // We don't write empty directories
        if (stat.isDirectory()) {
            return;
        }

        // If this came from a glob, add it to the file watchlist
        if (pattern.fromType === 'glob') {
            fileDependencies.push(file.absoluteFrom);
        }

        info(`reading ${file.absoluteFrom} to write to assets`);
        return fs.readFileAsync(file.absoluteFrom)
        .then((content) => {
            if (pattern.transform) {
                content = pattern.transform(content, file.absoluteFrom);
            }

            var hash = loaderUtils.getHashDigest(content);

            if (pattern.toType === 'template') {
                info(`interpolating template '${file.webpackTo}' for '${file.relativeFrom}'`);

                // If it doesn't have an extension, remove it from the pattern
                // ie. [name].[ext] or [name][ext] both become [name]
                if (!path.extname(file.relativeFrom)) {
                    file.webpackTo = file.webpackTo.replace(/\.?\[ext\]/g, '');
                }

                file.webpackTo = loaderUtils.interpolateName(
                    {resourcePath: file.absoluteFrom},
                    file.webpackTo,
                    {
                        content,
                        context: pattern.context
                    }
                );
            }

            if (!copyUnmodified &&
                written[file.absoluteFrom] && written[file.absoluteFrom][hash]) {
                info(`skipping '${file.webpackTo}', because it hasn't changed`);
                return;
            } else {
                debug(`added ${hash} to written tracking for '${file.absoluteFrom}'`);
                written[file.absoluteFrom] = {
                    [hash]: true
                };
            }

            if (compilation.assets[file.webpackTo] && !file.force) {
                info(`skipping '${file.webpackTo}', because it already exists`);
                return;
            }

            info(`writing '${file.webpackTo}' to compilation assets from '${file.absoluteFrom}'`);
            compilation.assets[file.webpackTo] = {
                size: function() {
                    return stat.size;
                },
                source: function() {
                    return content;
                }
            };
        });
    });
}
