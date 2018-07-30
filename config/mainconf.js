// config/database.js
var configGlobal = {
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

    // 'cropHealth': {
    //     'good': 21,
    //     'medium': 27,
    //     'poor': 31
    // }

    'General_health': {
        'GOOD': 21,
        'MEDIUM': 27,
        'POOR': 31
    },


    // ish eye distance for switch placemark to heatmap until eyeDistance_Heatmap less than 4500 (km)
    'eyeDistance_switch': 4500,

    // ish initial eye distance (m)
    'eyeDistance_initial': 9000000
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = configGlobal;
} else {
    window.config = configGlobal;
}
