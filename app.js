/**
 * Module dependencies.
 */

var express = require('express'),
    elasticsearch = require('elasticsearch'),
    url = require('url'),
    http = require('http'),
    app = express(),
    server = http.createServer(app),
    path = require('path'),
    logger = require('morgan'),
    methodOverride = require('method-override'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    errorHandler = require('errorhandler'),
    fs = require('fs');

var connectionString = 'localhost:9200';

if (process.env.SEARCHBOX_URL) {
    // Heroku
    connectionString = process.env.SEARCHBOX_URL;
} else if (process.env.SEARCHLY_URL) {
    // CloudControl, Modulus
    connectionString = process.env.SEARCHLY_URL;
} else if (process.env.VCAP_SERVICES) {
    // Pivotal, Openshift
    connectionString = JSON.parse(process.env.VCAP_SERVICES)['searchly-n/a'][0]['credentials']['uri'];
}

console.info(connectionString);

var client = new elasticsearch.Client({
    host: connectionString,
    log: 'debug'
});

var _index = "company";
var _type = 'employee';

// configuration
app.set('port', process.env.PORT || 4000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(methodOverride());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(multer());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', function (req, res) {
    res.render('index', {"result": ""})
});

app.get('/index', function (req, res) {

    client.indices.delete({index: _index});

    //INFO: https://www.elastic.co/guide/en/elasticsearch/guide/current/_index_time_search_as_you_type.html
    client.indices.create({
        index: _index,
        body: {
            "settings": {
                "analysis": {
                    "filter": {
                        "autocomplete_filter": {
                            "type": "edge_ngram",
                            "min_gram": 1,
                            "max_gram": 10
                        }
                    },
                    "analyzer": {
                        "autocomplete": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": [
                                "lowercase",
                                "autocomplete_filter"
                            ]
                        }
                    }
                }
            },
            "mappings": {
                "employee": {
                    "properties": {
                        "city": {
                            "type": "string",
                            "fields": {
                                "raw": {"type": "string", "index": "not_analyzed"}
                            }
                        },
                        "country": {
                            "type": "string",
                            "fields": {
                                "raw": {"type": "string", "index": "not_analyzed"}
                            }
                        },
                        "first_name": {
                            "type": "string",
                            "fields": {
                                "autocomplete": 
                                {
                                    "type": "string", 
                                    "index_analyzer": "autocomplete"
                                }
                            }
                        },
                        "last_name": {
                            "type": "string"
                        },
                        "gender": {
                            "type": "string",
                            "fields": {
                                "raw": {"type": "string", "index": "not_analyzed"}
                            }
                        },
                        "job_title": {
                            "type": "string",
                            "fields": {
                                "raw": {"type": "string", "index": "not_analyzed"}
                            }
                        },
                        "language": {
                            "type": "string",
                            "fields": {
                                "raw": {"type": "string", "index": "not_analyzed"}
                            }
                        }
                    }
                }
            }
        }

    }, function (error, response) {
        fs.readFile('sample_data.json', 'utf8', function (err, data) {
            if (err) throw err;
            var sampleDataSet = JSON.parse(data);

            var body = [];

            sampleDataSet.forEach(function (item) {
                body.push({"index": {"_index": _index, "_type": _type}});
                body.push(item);
            });

            client.bulk({
                body: body
            }, function (err, resp) {
                res.render('index', {result: 'Indexing Completed!'});
            })
        });
    })
})
;

app.get('/autocomplete', function (req, res) {
    console.log("Searching..");
    /**INFO: made it work.now it searches against the first name field and shows up.
    TODO#1: make it also search against lastname
    TODO#2: After that understand how the autocomplete search works. 
    INFO:
    GET /my_index/my_type/_validate/query?explain
        {
            "query": {
                "match": {
                    "name": "brown fo"
                }
            }
        }
    https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html
    https://www.elastic.co/guide/en/elasticsearch/reference/current/search-validate.html    
    **/
    client.indices.validateQuery({
        index: _index,
        type: _type,
        rewrite: true,
        explain: true,
        body: {
            "query": {
                "bool": {
                    "must": {
                        "multi_match": {
                            "query": req.query.term,
                            "fields": ["first_name"]
                        }
                    }
                }
            }
        }
    }).then(function (resp) {
        console.log("query validated for autocomplete");
        //console.log(resp);
        //var str = JSON.stringify(resp, null, 2);
        console.log(JSON.stringify(resp, null, 2));

    }, function (err) {
        console.trace(err.message);
    });  

    client.indices.validateQuery({
        index: _index,
        type: _type,
        rewrite: true,
        explain: true,
        body: {
            "query": {
                "bool": {
                    "must": {
                        "multi_match": {
                            "query": req.query.term,
                            "fields": ["first_name"]
                        }
                    }
                }
            }
        }
    }).then(function (resp) {
        console.log("query validated for autocomplete");
        //console.log(resp);
        //var str = JSON.stringify(resp, null, 2);
        console.log(JSON.stringify(resp, null, 2));

    }, function (err) {
        console.trace(err.message);
    });          

    /**
    https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html
    **/
    client.explain({
        index: _index,
        type: _type,
        body: {
            "query": {
                "bool": {
                    "must": {
                        "multi_match": {
                            "query": req.query.term,
                            "fields": ["first_name"]
                        }
                    }
                }
            }
        }
    }).then(function (resp) {
        console.log("Explanation received for autocomplete");
        console.log(JSON.stringify(resp, null, 2));
    }, function (err) {
        console.trace(err.message);
    });

    client.search({
        index: _index,
        type: _type,
        body: {
            "query": {
                "bool": {
                    "must": {
                        "multi_match": {
                            "query": req.query.term,
                            "fields": ["first_name"]
                        }
                    }
                }
            }
        }
    }).then(function (resp) {
        console.log("response received for autocomplete");
        console.log(resp);

        var results = resp.hits.hits.map(function(hit){
            return hit._source.first_name + " " + hit._source.last_name;
        });

        res.send(results);
    }, function (err) {
        console.trace(err.message);
        res.send({response: err.message});
    });
});

app.get('/search', function (req, res) {

    var aggValue = req.query.agg_value;
    var aggField = req.query.agg_field;

    var filter = {};
    filter[aggField] = aggValue;

    client.search({
        index: _index,
        type: _type,
        body: {
            "query": {
                "bool": {
                    "must": {
                        "multi_match": {
                            "query": req.query.q,
                            "fields": ["first_name^100", "last_name^20", "gender^5", "country^5", "city^3", "language^10", "job_title^50"],
                            "fuzziness": 1
                        }
                    },
                    "filter": {
                        "term": (aggField ? filter : undefined)
                    }
                }

            },
            "aggs": {
                "gender": {
                    "terms": {
                        "field": "gender.raw"
                    }
                },
                "country": {
                    "terms": {
                        "field": "country.raw"
                    }
                },
                "city": {
                    "terms": {
                        "field": "city.raw"
                    }
                },
                "language": {
                    "terms": {
                        "field": "language.raw"
                    }
                },
                "job_title": {
                    "terms": {
                        "field": "job_title.raw"
                    }
                }
            },
            "suggest": {
                "text": req.query.q,
                "simple_phrase": {
                    "phrase": {
                        "field": "first_name",
                        "size": 1,
                        "real_word_error_likelihood": 0.95,
                        "max_errors": 0.5,
                        "gram_size": 2,
                        "direct_generator": [{
                            "field": "first_name",
                            "suggest_mode": "always",
                            "min_word_length": 1
                        }],
                        "highlight": {
                            "pre_tag": "<b><em>",
                            "post_tag": "</em></b>"
                        }
                    }
                }
            }
        }
    }).then(function (resp) {
        console.log(resp);
        res.render('search', {response: resp, query: req.query.q});
    }, function (err) {
        console.trace(err.message);
        res.render('search', {response: err.message});
    });
});

app.get('/about', function (req, res) {
    res.render('about');
});

// error handling middleware should be loaded after the loading the routes
if ('development' == app.get('env')) {
    app.use(errorHandler());
}

app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
