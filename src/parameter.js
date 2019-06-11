let mod = {

    DEBUG: true,
    CRITICAL_BUCKET_LEVEL: 1000, // take action when the bucket drops below this value to prevent the bucket from actually running out
    CRITICAL_BUCKET_OVERFILL: 200,
    DIRECTORIES: ['./', './lib.', './prototypes.'],

};

module.exports = mod;
