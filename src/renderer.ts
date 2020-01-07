// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

import * as request from 'request';
import * as ytdl from 'ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import { Readable } from 'stream';
import * as path from 'path';
import { setTimeout } from 'timers';

let videoTmp: IVideo | null = null;
let dispatcher: Readable | null = null;

const urlChecker = /^(?:(?:https?:)?\/\/)?(?:(?:www|m)\.)?(?:(?:youtube\.com|youtu.be))(?:\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/;

document.querySelector('#getInfoBtn').addEventListener('click', getData);
document.querySelector('#downloadBTN').addEventListener('click', () => {
    (<HTMLButtonElement>document.getElementById('downloadBTN')).disabled = true;
    downloadVideo();
});
document.querySelector('#cancleBTN').addEventListener('click', () => {
    if (dispatcher !== null) dispatcher!.destroy();
    dispatcher = null;
    document.getElementById('details-content').className = 'hidden';
});

function getData() {
    const url = (<HTMLInputElement>document.getElementById('yturlInput'));
    if (url && !urlChecker.test(url.value)) {
        alert('Url shouldn\'t be empty');
        url.value = '';
    }

    try {
        const YTid = urlChecker.exec(url.value);

        request('https://www.googleapis.com/youtube/v3/videos?part=snippet%2CcontentDetails%2Cstatistics&id=' + YTid![1] +
            '&fields=items(id%2Csnippet(thumbnails%2Fmedium%2Furl%2Ctitle))&key=AIzaSyDdnzYi8J5xgz0BzAWZOX1dWSyjmzdeCSI',
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const data = JSON.parse(body);

                    videoTmp = {
                        id: data.items[0].id,
                        url: url.value,
                        title: data.items[0].snippet.title,
                        imgUrl: data.items[0].snippet.thumbnails.medium.url
                    };

                    ytdl.getInfo(url.value, (err, info) => {
                        if (err) throw err;
                        const qualitySelector = (<HTMLSelectElement>document.getElementById('inputGroupSelect01'));
                        // qualitySelector.removeChild(document.querySelector('option'));
                        qualitySelector.innerHTML = '<option selected>Choose...</option>';

                        console.info(info.formats);

                        info.formats.forEach(element => {
                            if (!element.audioBitrate && (element.encoding === 'VP9' || element.encoding === 'VP8')) {
                                var option = document.createElement("option");
                                option.value = element.itag;
                                option.text = element.resolution;
                                qualitySelector.appendChild(option);
                            }
                        });
                    });
                    showDetails(videoTmp);
                }
            });
    } catch (e) {
        console.error(e);
    }
}

interface IVideo {
    id: string;
    url: string;
    title: string;
    imgUrl: string;
}

function showDetails(data: IVideo) {
    (<HTMLImageElement>document.getElementById('details-img')).src = data.imgUrl;
    (<HTMLLabelElement>document.getElementById('details-title')).textContent = data.title;
    document.getElementById('details-content').className = '';
}

function downloadVideo() {
    let oldPercent = 0;

    (<HTMLDivElement>document.getElementById('progress')).className = 'progress';

    const progressLabel = (<HTMLDivElement>document.getElementById('progress-detail'));
    const progressSelector = (<HTMLDivElement>document.getElementById('progress-bar'));
    const qualitySelector = (<HTMLSelectElement>document.getElementById('inputGroupSelect01')).value;
    const fileExtensionSelector = (<HTMLSelectElement>document.getElementById('inputGroupSelect02')).value;

    progressSelector.style.width = `0%`;

    let fileExtensionString: string;

    switch (fileExtensionSelector) {
        case '1': fileExtensionString = 'webm'; break;
        case '2': fileExtensionString = 'mp4'; break;
        default: fileExtensionString = 'webm'; break;
    }

    let videoFile: any | null = null;

    dispatcher = ytdl(videoTmp.url, { quality: 'highestaudio', filter: 'audioonly' });
    dispatcher.pipe(fs.createWriteStream('download/song.tmp'))
    dispatcher.on('error', () => {
        alert('Error!');
        (<HTMLDivElement>document.getElementById('progress')).className = 'progress hidden';
        progressSelector.style.width = `0%`;
        (<HTMLButtonElement>document.getElementById('downloadBTN')).disabled = false;
        dispatcher = null;
    });
    dispatcher.on('destroy', () => {
        (<HTMLDivElement>document.getElementById('progress')).className = 'progress hidden';
        document.getElementById('details-content').className = 'hidden';
        progressSelector.style.width = `0%`;
        (<HTMLButtonElement>document.getElementById('downloadBTN')).disabled = false;
        dispatcher = null;
    });
    dispatcher.on('progress', (chunkLength, downloaded, total) => {
        let percent = Math.floor((downloaded / total) * 100);
        if (oldPercent !== percent) {
            progressLabel.innerText = 'Downloading audio... (1/2)';
            console.info(percent);
            progressSelector.style.width = `${percent}%`;
            oldPercent = percent;
        }
    })
    dispatcher.on('finish', () => {
        dispatcher = ytdl(videoTmp.url, {
            quality: qualitySelector
        });

        ffmpeg()
            .input(dispatcher)
            .videoCodec(fileExtensionSelector === '1' ? 'copy' : 'libx264')
            .input('download/song.tmp')
            .on('error', console.error)
            .save('download/' + videoTmp.id + '.' + fileExtensionString);

        dispatcher.on('progress', (chunkLength, downloaded, total) => {
            let percent = Math.floor((downloaded / total) * 100);
            if (oldPercent !== percent) {
                progressLabel.innerText = 'Downloading & Encoding video... (2/2)';
                console.info(percent);
                progressSelector.style.width = `${percent}%`;
                oldPercent = percent;
            }
        });
        dispatcher.on('error', () => {
            alert('Error!');
            (<HTMLDivElement>document.getElementById('progress')).className = 'progress hidden';
            progressSelector.style.width = `0%`;
            (<HTMLButtonElement>document.getElementById('downloadBTN')).disabled = false;
            dispatcher = null;
        });
        dispatcher.on('destroy', () => {
            (<HTMLDivElement>document.getElementById('progress')).className = 'progress hidden';
            document.getElementById('details-content').className = 'hidden';
            progressSelector.style.width = `0%`;
            (<HTMLButtonElement>document.getElementById('downloadBTN')).disabled = false;
            dispatcher = null;
        });
        dispatcher.on('end', () => {
            (<HTMLDivElement>document.getElementById('progress')).className = 'progress hidden';
            document.getElementById('details-content').className = 'hidden';
            progressSelector.style.width = `0%`;
            (<HTMLButtonElement>document.getElementById('downloadBTN')).disabled = false;
            dispatcher = null;
        });
        dispatcher.on('finish', () => {
            alert('Done!');
            progressLabel.innerText = '';

            setTimeout(() => {
                fs.unlinkSync('download/song.tmp');
            }, 5000);
        });
    });
}
