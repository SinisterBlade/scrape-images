const express = require('express')
const fs = require('fs')
const request = require('request')
const cheerio = require('cheerio')
const archiver = require('archiver')
const mime = require('mime-types')

const app = express()

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html')
})

app.get('/scrape', function (req, res) {
    let query = req.query.q
    let numberOfImages = req.query.num
    let options = {
        url: 'https://www.google.co.in/search?q=' + query + '&tbm=isch&source=lnms',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36'
        }
    }
    let allImageUrls = []
    let imagesToBeDownloaded = []
    request(options, function (err, status, html) {
        if (!err) {
            let $ = cheerio.load(html)
            $('.rg_el').filter(function () {
                let data = $(this).children('.rg_meta').text()
                let imageUrl = JSON.parse(data)['ou']
                allImageUrls.push(imageUrl)
            })

            imagesToBeDownloaded = allImageUrls.slice(0, numberOfImages)
            let imagePromises = imagesToBeDownloaded.map(function (url, index) {
                return downloadFile(url, index, query)
            })

            Promise.all(imagePromises)
                .then(() => zipFolder(query, query))
                .then(() => console.log('Done zipping'))
                .then(() => fs.rename(query, 'images/' + query))
                .then(() => res.sendStatus(200))
                .catch((reason) => {
                    console.log('My error: ' + reason)
                    res.sendStatus(500)
                })
        }
        else {
            console.log(err)
            res.sendStatus(500)
        }
    })
})

function downloadFile(url, filename, foldername) {
    return new Promise(function (resolve, reject) {
        if (!fs.existsSync(foldername)) {
            fs.mkdirSync(foldername)
        }
        let r = request(url)
        r.on('error', (err) => resolve()) // BAD
        r.on('response', (response) => {
            let contentType = response.headers['content-type']
            if (response.statusCode == 200 && contentType.startsWith('image')) {
                console.log('Content type:' + contentType)
                let fileExtension = '.'
                fileExtension += mime.extension(contentType) ? mime.extension(contentType) : "jpg"
                r.pipe(fs.createWriteStream(foldername + '/' + filename + fileExtension)).on('close', () => resolve())
            }
            else {
                resolve() // BAD
            }
        })
    })
}

function zipFolder(foldername, zipfilename) {
    return new Promise(function (resolve, reject) {
        let output = fs.createWriteStream(__dirname + '/zip/' + zipfilename + '.zip');
        let archive = archiver('zip', {
            store: true
        });
        output.on('close', function () {
            resolve()
        });
        archive.on('error', function (err) {
            reject(err)
        });
        archive.pipe(output);
        archive.directory(foldername + '/');
        archive.finalize();
    })
}

app.listen(3000, function () {
    console.log('Listening on 3000')
})