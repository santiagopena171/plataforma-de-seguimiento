const xlsx = require('xlsx');

const filePath = 'C:\\Users\\Santiago Peña\\Downloads\\Resultados_Web_MRN_20260222.xls';

try {
    console.log('Leyendo:', filePath);
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); // read as array of arrays

    let out = '';
    out += 'Primeras 50 filas del Excel:\n';
    for (let i = 0; i < Math.min(50, data.length); i++) {
        out += `Fila ${i}: ` + JSON.stringify(data[i]) + '\n';
    }

    const fs = require('fs');
    fs.writeFileSync('scripts/excel_output.txt', out);
    console.log('Guardado en scripts/excel_output.txt');
} catch (err) {
    console.error('Error:', err.message);
}
