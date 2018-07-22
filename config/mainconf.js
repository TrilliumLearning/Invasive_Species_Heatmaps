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

    'Session_db': 'Invasive_Species_Heatmaps',
    'Login_db': 'Invasive_Species_Heatmaps',
    'Login_table': 'Users',
    'Upload_db': 'Invasive_Species_Heatmaps',

    'Server_Port': 9087,

    'Upload_Path': 'http://ish.aworldbridgelabs.com/uploadfiles',

    'cropHealth': {
        'good': 21,
        'medium': 27,
        'poor': 31
    }

};
