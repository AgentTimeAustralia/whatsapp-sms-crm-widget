/*
Copyright (c) 2017, ZOHO CORPORATION
License: MIT
*/

const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const errorHandler = require("errorhandler");
const morgan = require("morgan");
const serveIndex = require("serve-index");
const https = require("https");
const axios = require("axios");

process.env.PWD = process.env.PWD || process.cwd();

const expressApp = express();
const port = 5000;

// ======================================================
// BASIC EXPRESS SETUP
// ======================================================

expressApp.set("port", port);

expressApp.use(morgan("dev"));

expressApp.use(bodyParser.json({
    limit: "10mb"
}));

expressApp.use(bodyParser.urlencoded({
    extended: false
}));

expressApp.use(errorHandler());

// ======================================================
// CORS
// ======================================================

expressApp.use(function(req, res, next){

    // DEV ONLY
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    // HANDLE PREFLIGHT
    if(req.method === "OPTIONS"){
        return res.sendStatus(200);
    }

    next();
});

// ======================================================
// ENV VALIDATION
// ======================================================

if(!process.env.HTAG_API_KEY){

    console.error("HTAG_API_KEY missing");
    process.exit(1);
}

console.log(
    "ENV KEY EXISTS:",
    !!process.env.HTAG_API_KEY
);

// ======================================================
// ROOT ROUTE
// ======================================================

expressApp.get("/", function(req, res){

    return res.send(`
        <h2>Agent Time Widget Backend Running</h2>
        <p>HTTPS Server Active</p>
    `);
});

// ======================================================
// HEALTH CHECK
// ======================================================

expressApp.get("/health", function(req, res){

    return res.send({
        success: true,
        status: "running"
    });
});

// ======================================================
// MANIFEST
// ======================================================

expressApp.get("/plugin-manifest.json", function(req, res){

    res.sendFile(
        __dirname + "/../plugin-manifest.json"
    );
});

// ======================================================
// STATIC APP
// ======================================================

expressApp.use(
    "/app",
    express.static(
        __dirname + "/../app"
    )
);

expressApp.use(
    "/app",
    serveIndex(
        __dirname + "/../app"
    )
);

// ======================================================
// HTAG COMPARABLE SALES API
// ======================================================

expressApp.post(
    "/getComparableSales",
    async function(req, res){

    try{

        const addressKey = req.body.address_key;

        if(!addressKey){

            return res.status(400).send({
                success: false,
                message: "Missing address_key"
            });
        }

        console.log(
            "Comparable Sales Request:",
            addressKey
        );

        const response = await axios.get(
            "https://api.htagai.com/v1/property/sold/search",
            {
                params:{
                    address_key: addressKey,
                    radius_km: 2,
                    limit: 10
                },
                headers:{
                    "x-api-key":
                        process.env.HTAG_API_KEY
                },
                timeout: 30000
            }
        );

        return res.send(response.data);
    }
    catch(error){

        console.error(
            "HtAG API Error:",
            error.response?.data ||
            error.message ||
            error
        );

        return res.status(500).send({
            success:false,
            message:"Failed to fetch comparable sales"
        });
    }
});

// ======================================================
// HTTPS OPTIONS
// ======================================================

const options = {

    key: fs.readFileSync(
        __dirname + "/../key.pem"
    ),

    cert: fs.readFileSync(
        __dirname + "/../cert.pem"
    )
};

// ======================================================
// START SERVER
// ======================================================

https
.createServer(options, expressApp)
.listen(port, function(){

    console.log(
        "Zet running at https://127.0.0.1:" + port
    );

    console.log(
        "Open browser and approve SSL certificate if needed."
    );
})
.on("error", function(err){

    if(err.code === "EADDRINUSE"){

        console.log(
            port + " port is already in use"
        );
    }
    else{

        console.error(err);
    }
});