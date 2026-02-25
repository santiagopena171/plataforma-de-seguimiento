try {
    require('./scripts/sync-results-excel.js');
} catch (err) {
    console.error(err.stack);
}
