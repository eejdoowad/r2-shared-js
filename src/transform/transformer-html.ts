// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Publication } from "@models/publication";
import { Link } from "@models/publication-link";
import { bufferToStream, streamToBufferPromise } from "@r2-utils-js/_utils/stream/BufferUtils";
import { IStreamAndLength } from "@r2-utils-js/_utils/zip/zip";
import * as mime from "mime-types";
import { ITransformer } from "./transformer";

import * as debug_ from "debug";
const debug = debug_("r2:shared#transform/transformer-html");

export class TransformerHTML implements ITransformer {

    private readonly transformString: (publication: Publication, link: Link, data: string) => string;

    constructor(transformerFunction: (publication: Publication, link: Link, data: string) => string) {
        this.transformString = transformerFunction;
    }

    public supports(publication: Publication, link: Link): boolean {

        let mediaType = mime.lookup(link.Href);
        if (link && link.TypeLink) {
            mediaType = link.TypeLink;
        }

        if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
            const pubDefinesLayout = publication.Metadata && publication.Metadata.Rendition
                && publication.Metadata.Rendition.Layout;
            const pubIsFixed = pubDefinesLayout && publication.Metadata.Rendition.Layout === "fixed";

            const linkDefinesLayout = link.Properties && link.Properties.Layout;
            const linkIsFixed = linkDefinesLayout && link.Properties.Layout === "fixed";

            if (linkIsFixed || pubIsFixed) {
                return false;
            }

            return true; // pass: reflow doc
        }

        return false;
    }

    public async transformStream(
        publication: Publication, link: Link,
        stream: IStreamAndLength,
        _isPartialByteRangeRequest: boolean,
        _partialByteBegin: number, _partialByteEnd: number): Promise<IStreamAndLength> {

        let data: Buffer;
        try {
            data = await streamToBufferPromise(stream.stream);
        } catch (err) {
            return Promise.reject(err);
        }

        let buff: Buffer;
        try {
            buff = await this.transformBuffer(publication, link, data);
        } catch (err) {
            return Promise.reject(err);
        }

        const sal: IStreamAndLength = {
            length: buff.length,
            reset: async () => {
                return Promise.resolve(sal);
            },
            stream: bufferToStream(buff),
        };
        return Promise.resolve(sal);
    }

    private async transformBuffer(publication: Publication, link: Link, data: Buffer): Promise<Buffer> {

        try {
            const str = data.toString("utf8");
            const str_ = this.transformString(publication, link, str);
            return Promise.resolve(Buffer.from(str_));
        } catch (err) {
            debug("TransformerHTML fail => no change");
            debug(err);
            return Promise.resolve(data); //  no change
        }
    }
}
