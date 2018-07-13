// config/database.js
module.exports = {
    'commondb_connection': {
        'multipleStatements': true,
        'connectionLimit' : 100,
        'host': '10.11.90.15',
        'user': 'AppUser',
        'password': 'Special888%',
        'port'    :  3306
    },
    'session_connection': {
        'multipleStatements': true,
        'connectionLimit' : 100,
        'host': '10.11.90.15',
        'user': 'AppUser',
        'password': 'Special888%',
        'port'    :  3306
    },

    'Session_db': 'FAW_PUB',
    'Login_db': 'FAW_PUB',
    'Login_table': 'Users',
    'Upload_db': 'FAW_PUB',

    'Server_Port': 9087,

    'Upload_Path': 'http://pub.faw.aworldbridgelabs.com/uploadfiles',

    'cropHealth': {
        'good': 1,
        'medium': 2,
        'poor': 3
    }

};
