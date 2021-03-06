'use strict';

const {Router} = require('express');
const jsonParser = require('body-parser').json();
const debug = require('debug')('homeSecure:enrollee-router');
const multer = require('multer');
const Enrollee = require('../model/enrollee.js');
const upload = multer({dest:`${__dirname}/../assets/image`});
const bearerAuth = require('../lib/bearer-auth.js');
const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const superagent = require('superagent');
const uuid = require('uuid');

const gstorage = require('@google-cloud/storage')({
  credentials: JSON.parse(process.env.FIREBASE_CERT),
});

const enrolleeRouter = module.exports = new Router();

enrolleeRouter.post('/api/enrollee', bearerAuth, jsonParser, upload.single('image'), (req, res, next) => {
  debug('POST /api/enrollee');
  let subject_id = uuid.v1();
  // TODO: upload to kairos here then , firebase then create enrollee
  fs.readFileAsync(req.file.path)
  .then(buf => {
    let base64image = buf.toString('base64');
    return base64image;
  })
  .then((base64image) => {
    return superagent.post('https://api.kairos.com/enroll')
    .set('app_id', process.env.app_id)
    .set('app_key', process.env.app_key)
    .send({
      'image' : base64image,
      'subject_id' : subject_id,
      'gallery_name': process.env.HOMESECURE_GALLERY,
    });
  })
  .then(() => {
    let bucket = gstorage.bucket(`${process.env.FIREBASE_PROJECT_ID}.appspot.com`);
    return bucket.upload(req.file.path);

  })
  .then(response => {
    return new Enrollee ({
      id: subject_id,
      password: req.body.password,
      name: req.body.name,
      img: `https://firebasestorage.googleapis.com/v0/b/homesecure-67979.appspot.com/o/${response[0].name}?alt=media`,


    }).save()
    .then(enrollee => {
      res.json(enrollee);
    })
    .catch(next);

  })
  .catch(err => {
    next(err);
  });

});

enrolleeRouter.get('/api/enrollee', bearerAuth, jsonParser, (req, res, next) => {
  debug('GET all /api/enrollee');
  Enrollee.fetchAll()
  .then(enrollees => res.json(enrollees))
  .catch(next);
});

enrolleeRouter.get('/api/enrollee/:id', jsonParser, (req, res, next) => {
  debug('GET /api/enrollee/:id');
  Enrollee.findById(req.params.id)
  .then(enrollee => res.json(enrollee))
  .catch(next);
});

enrolleeRouter.delete('/api/enrollee/:id', bearerAuth, jsonParser, (req, res, next) => {
  //TODO further checks needed on functionality. Still unsure on how to adjust this put request
  debug('DELETE /api/enrollee/:id');
  Enrollee.findByIdAndDelete(req.params.id)
  .then(new Enrollee(req.body).save())
  .then(enrollee => {
    res.sendStatus(204);
    console.log(enrollee);
  })
  .catch(next);
});
