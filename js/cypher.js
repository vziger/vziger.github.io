const LETTERS = ['а', 'б', 'в', 'г', 'д', 'е', 'ё', 'ж', 'з', 'и', 'й', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'ъ', 'ы', 'ь', 'э', 'ю', 'я']
const DO_NOT_CYPHER = ['\x0A', ' ', '.', ',', '!', '?', '-', '«', '»', ':', ';', '(', ')', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '\"']

const ENGLISH = /[A-Za-z]/g
const cypher_alphabets = [
    [33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122],
    [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90],
    [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
    [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90]
]

const cypher_fonts =
[{
    name: 'swifty',
    exercise_font_size: '32px',
    exercise_line_height: '32px',
    pdf_title_size: '36px',
    pdf_main_text_size: '37px',
    pdf_main_text_line_height: '37px',
    letter_spacing: '3px'
},

{
    name: 'nox',
    exercise_font_size: '32px',
    exercise_line_height: '32px',
    pdf_title_size: '30px',
    pdf_main_text_size: '37px',
    pdf_main_text_line_height: '38px',
    letter_spacing: '4px'
},
{
    name: 'pictopeeps',
    exercise_font_size: '20px',
    exercise_line_height: '20px',
    pdf_title_size: '24px',
    pdf_main_text_size: '27px',
    pdf_main_text_line_height: '36px',
    letter_spacing: '4px'
},
{
    name: 'braillefont',
    exercise_font_size: '28px',
    exercise_line_height: '28px',
    pdf_title_size: '28px',
    pdf_main_text_size: '40px',
    pdf_main_text_line_height: '36px',
    letter_spacing: '2px'
}]

let shuffle_arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]

const MAX_CHARS_NUM = 120

let substitution = null
let cypher_symbols_number = null

let key_el = null
let text_to_cypher_el = null
let char_counter_el = null
let max_chars_num_el = null
let cyphered_text_el = null
let error_el = null

let string_to_cypher = null


function ready() {
    document.documentElement.style.setProperty('--all-controls-block-height', '214px')
    document.getElementById('start_button').style.setProperty('visibility', 'visible')

    cypher_symbols_number = Number(document.querySelector('input[type="radio"][name="btnradio-symbols"]:checked').getAttribute('data-symbols'))

    key_el = document.getElementById('key')
    text_to_cypher_el = document.getElementById('text_to_cypher')
    const string_end  = text_to_cypher_el.value.length
    text_to_cypher_el.maxLength = MAX_CHARS_NUM
    text_to_cypher_el.setSelectionRange(string_end, string_end)
    text_to_cypher_el.focus()

    char_counter_el  = document.getElementById('char_counter')
    max_chars_num_el = document.getElementById('max_chars_num')
    cyphered_text_el = document.getElementById('cyphered_text')
    error_el = document.getElementById('error')

    max_chars_num_el.innerText = MAX_CHARS_NUM
    cyphered_text_el.style.fontFamily = cypher_fonts[cypher_symbols_number].name

    kanzas_city_shuffle(shuffle_arr)
    generate_cypher_key_html()

    prepare_text_to_cypher()
    count_chars()
    cypher()


    text_to_cypher_el.addEventListener('keyup', function(event) {
        prepare_text_to_cypher()
        count_chars()
        cypher()
      })
}


function recypher() {
    cypher_symbols_number = Number(document.querySelector('input[type="radio"][name="btnradio-symbols"]:checked').getAttribute('data-symbols'))
    cyphered_text_el.style.fontFamily = cypher_fonts[cypher_symbols_number].name
    console.log('cypher_symbols_number =', cypher_symbols_number)
    console.log('cypher_fonts[cypher_symbols_number].name =', cypher_fonts[cypher_symbols_number].name)

    generate_cypher_key_html()
    cypher()
}


function count_chars() {
    char_counter_el.innerText = MAX_CHARS_NUM - text_to_cypher_el.value.length
}


function generate_key() {
    substitution = new Map()
    for (let i = 0; i < LETTERS.length; i++) {
        item = {
            symbol: String.fromCharCode(cypher_alphabets[cypher_symbols_number][shuffle_arr[i]]),
            font: cypher_fonts[cypher_symbols_number].name
        }
        substitution.set(LETTERS[i], item)
    }

    substitution.set(DO_NOT_CYPHER[0],{symbol: '<br>', font:''})
    for (let i = 1; i < DO_NOT_CYPHER.length; i++) {
        item = {
            symbol: DO_NOT_CYPHER[i],
            font: 'Montserrat, Arial'
        }
        substitution.set(DO_NOT_CYPHER[i], item)
    }
}


function generate_cypher_key_html() {
    generate_key()
    console.log(substitution)
    let cypher_key_html = ''
    let pdx = (substitution.get('ф').font === 'braillefont') ? ' my-px-sm' : ''

    for (let i = 0; i < LETTERS.length; i++) {
        let ch = substitution.get(LETTERS[i])
        cypher_key_html += '<table class="table table-sm table-borderless d-inline-block" style="font-size: inherit; max-width: fit-content">'
        cypher_key_html += '<tr><td class="px-0" style="text-align: center; vertical-align: bottom; height: 50px;">'
        cypher_key_html += LETTERS[i] + '</td></tr>'

        cypher_key_html += '<tr><td class="py-0'+ pdx + '" '
        cypher_key_html += 'style="text-align: center; vertical-align: middle; height: 50px;'
        cypher_key_html += 'font-family:' + ch.font + ', sans-serif;'
        cypher_key_html += 'font-size:' + cypher_fonts[cypher_symbols_number].exercise_font_size + '; '
        cypher_key_html += 'line-height:' + cypher_fonts[cypher_symbols_number].exercise_line_height + ';">'
        cypher_key_html += ch.symbol + '</td></tr>'
        cypher_key_html += '</table>'
    }
    key_el.innerHTML = cypher_key_html
}


function prepare_text_to_cypher() {
    if(ENGLISH.test(text_to_cypher_el.value)) {
        text_to_cypher_el.value = text_to_cypher_el.value.replace(ENGLISH, '')
        error_el.innerText = 'Удалены английские буквы из текста'
        error_el.style.visibility = 'visible'
    } else {
        error_el.style.visibility = 'hidden'
    }
    // \xa0 — неразрывный пробел
    string_to_cypher = text_to_cypher_el.value.replaceAll('\xa0', ' ').toLowerCase().trim()
}


function make_cyphered_text(text_to_cypher) {
    let cyphered_text = ''
    for (let i = 0; i < text_to_cypher.length; i++) {
        char_to_cypher = text_to_cypher.charAt(i)
        console.log('text_to_cypher.charAt(i) =', text_to_cypher.charAt(i))
        console.log('text_to_cypher.charCodeAt(i) =', text_to_cypher.charCodeAt(i))
        console.log('substitution.get(text_to_cypher.charAt(i)) =', substitution.get(text_to_cypher.charAt(i)))

        let ch = substitution.get(char_to_cypher)
        if (ch == undefined) {
            cyphered_text += ' '
        } else if(char_to_cypher == DO_NOT_CYPHER[0]) {
            cyphered_text += ch.symbol
        } else if(DO_NOT_CYPHER.includes(char_to_cypher)) {
            cyphered_text += '<span style="font-family:' + ch.font + ', sans-serif;">'
            cyphered_text += ch.symbol
            cyphered_text += '</span>'
        }
        else {
            cyphered_text += ch.symbol
        }
    }
    return cyphered_text
}


function cypher() {
    const color = (string_to_cypher == '') ? 'darkgray' : 'black'
    let cyphered_text = ''
    if (string_to_cypher) {
        cyphered_text = make_cyphered_text(string_to_cypher)
    } else {
        console.log('cipher_text_content === empty')
        cyphered_text = make_cyphered_text(text_to_cypher_el.placeholder.toLowerCase())
    }
    cyphered_text_el.style.color = color
    cyphered_text_el.innerHTML   = cyphered_text
    cyphered_text_el.style.fontSize = cypher_fonts[cypher_symbols_number].exercise_font_size
}


function clear_textarea() {
    text_to_cypher_el.value = ''
    text_to_cypher_el.focus()
    string_to_cypher = ''
    count_chars()
    cypher()
}


function gen_key_html_for_pdf(){
    let cypher_key_html = '<table class="table table-sm table-border d-inline-block" style="max-width: fit-content; border-left:1px solid #e0e0e0;"><tr>'

    for (let i = 0; i < LETTERS.length; i++) {
        cypher_key_html += '<td class="pt-1 pb-2" style="text-align: center; vertical-align: center; font-size: 20px; padding-left:8px; padding-right:8px;">' + LETTERS[i] + '</td>'
    }
    cypher_key_html += '</tr><tr>'
    for (let i = 0; i < LETTERS.length; i++) {
        let ch = substitution.get(LETTERS[i])
        cypher_key_html += '<td style="text-align: center; vertical-align: top;'
        cypher_key_html += 'font-family: ' + ch.font + ', sans-serif;'
        cypher_key_html += 'font-size:' + cypher_fonts[cypher_symbols_number].pdf_title_size + '">'
        cypher_key_html += ch.symbol + '</td>'
    }
    cypher_key_html += '</tr></table>'
    return cypher_key_html
}


function print_js2pdf() {
    let cypheredtext_content = document.getElementById('cyphered_text')
    let cypher_key_element   = document.createElement('div')

    let pdf_document_element  = document.createElement('div')
    let student_sheet_element = document.createElement('div')
    let teacher_sheet_element = document.createElement('div')

    let student_write_element = document.createElement('div')
    let teacher_write_element = document.createElement('div')
    let cyphered_col  = document.createElement('div')
    let write_col     = document.createElement('div')
    let original_text_col = document.createElement('div')

    student_write_element.classList.add('row')
    teacher_write_element.classList.add('row')
    cyphered_col.classList.add('col-6')
    write_col.classList.add('col-6')
    original_text_col.classList.add('col-6')

    cypher_key_element.classList.add('mb-3')
    cypher_key_element.innerHTML = gen_key_html_for_pdf()

    let cyphered_clone = cypheredtext_content.cloneNode(true)
    cyphered_clone.style.fontSize = cypher_fonts[cypher_symbols_number].pdf_main_text_size
    cyphered_clone.style.lineHeight = cypher_fonts[cypher_symbols_number].pdf_main_text_line_height
    cyphered_clone.style.wordWrap = 'normal'
    cyphered_clone.style.letterSpacing = cypher_fonts[cypher_symbols_number].letter_spacing
    cyphered_clone.style.color = 'black'
    cyphered_clone.style.width = ''
    cyphered_clone.classList = ''

    let site = document.createElement('div')
    site.innerText = 'neuroexercise.ru'
    site.style.fontSize = '14px'
    site.style.fontFamily = 'Montserrat, sans-serif'
    site.style.paddingBottom = '8px'
    site.style.color = 'rgba(0, 0, 0, 0.3)'

    let site_teacher_sheet = document.createElement('div')
    site_teacher_sheet.classList.add('d-flex')
    site_teacher_sheet.classList.add('justify-content-between')
    site_teacher_sheet.innerHTML = '<div>neuroexercise.ru</div><div>Для учителя</div>'
    site_teacher_sheet.style.fontSize = '14px'
    site_teacher_sheet.style.fontFamily = 'Montserrat, sans-serif'
    site_teacher_sheet.style.paddingBottom = '8px'
    site_teacher_sheet.style.color = 'rgba(0, 0, 0, 0.3)'

    let header_key = document.createElement('div')
    header_key.innerText = 'Ключ к шифру'
    header_key.style.fontFamily = 'Montserrat, sans-serif'
    header_key.style.fontSize   = '20px'
    header_key.style.fontWeight = 600
    header_key.style.marginTop = '16px'
    header_key.style.marginBottom = '12px'

    let header_decypher = document.createElement('div')
    header_decypher.innerText = 'Расшифруйте текст'
    header_decypher.style.fontFamily = 'Montserrat, sans-serif'
    header_decypher.style.fontSize   = '20px'
    header_decypher.style.fontWeight = 600
    header_decypher.style.paddingBottom = '12px'

    write_col.style.lineHeight = '40px'
    write_col.style.color = '#e0e0e0'
    write_col.innerText = '__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n__________________________________________________________________________________\n'

    original_text_col.style.fontSize = '36px'
    original_text_col.style.lineHeight = '38px'
    original_text_col.style.color = 'black'
    if (string_to_cypher) {
        original_text_col.innerText = text_to_cypher_el.value
    }
    else {
        original_text_col.innerText = text_to_cypher_el.placeholder
    }


    student_sheet_element.append(site)
    student_sheet_element.append(header_key)
    student_sheet_element.append(cypher_key_element)
    student_sheet_element.append(header_decypher)

    cyphered_col.append(cyphered_clone)
    student_write_element.append(cyphered_col, write_col)
    student_sheet_element.append(student_write_element)
    student_sheet_element.style.breakAfter = 'page'


    teacher_sheet_element.append(site_teacher_sheet)
    teacher_sheet_element.append(header_key.cloneNode(true))
    teacher_sheet_element.append(cypher_key_element.cloneNode(true))
    teacher_sheet_element.append(header_decypher.cloneNode(true))

    teacher_write_element.append(cyphered_col.cloneNode(true), original_text_col)
    teacher_sheet_element.append(teacher_write_element)

    pdf_document_element.append(student_sheet_element, teacher_sheet_element)


    const opt = {
        margin: [14, 13, 14, 13],
        filename: 'cypher.pdf',
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'landscape',
            compress: true,
        },
        pagebreak: {
            mode: 'css',
            before: '.break-before',
            after: '.break-after',
            avoid: '.break-avoid',
        },
    }
    html3pdf().set(opt).from(pdf_document_element).save()
}
