function delete_elements(list_of_elements) {
    for (let i = list_of_elements.length - 1; i >=0 ; --i) {
        list_of_elements[i].remove()
    }
}


function create_new_cells_for_table(number, grid_table) {
    let new_cell
    for (let i = 0; i < number*number; i++) {
        new_cell = document.createElement('div')
        new_cell.setAttribute('class', 'cell')
        new_cell.setAttribute('data-number', i+1)
        new_cell.innerHTML = '*'
        grid_table.appendChild(new_cell)
    }
}


function selected_size_switcher(size){
    let grid_cells = document.getElementsByClassName('cell')
    let grid_table = document.querySelector('.grid')

    delete_elements(grid_cells)
    create_new_cells_for_table(size, grid_table)

    grid_table.style.setProperty('grid-template-columns', 'repeat(' + size + ', 120px)')
}

function kanzas_city_shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr
}

function display_hide_containers(list_elements, show_hide_flag) {
    for (let j = 0; j < list_elements.length ; j++) {
        list_elements[j].style.setProperty('display', show_hide_flag)
    }
}

function show_settings() {
    const root = document.documentElement;
    root.style.setProperty('--cell-blur', 'blur(8px)');
    root.style.setProperty('--cell-cursor', 'default');
    all_switchers_container = document.getElementsByClassName('all-switchers-container')
    results_container = document.getElementsByClassName('results-container')
    display_hide_containers(all_switchers_container, 'block')
    display_hide_containers(results_container, 'none')
    find_number_title_node.style.setProperty('visibility', 'hidden')
    find_number_node.style.setProperty('visibility', 'hidden')
    btn_show_settings.style.setProperty('visibility', 'hidden')
    btn_start.style.setProperty('display', 'inline-block');
    btn_again.style.setProperty('display', 'none');
}

let timer_id
let btn_start
let btn_again
let btn_stop
let btn_show_settings
let switch_hint_node
let all_switchers_container
let results_container
let find_number_title_node
let find_number_node

function stop_schulte() {
    const root = document.documentElement;
    clearInterval(timer_id);
    btn_stop.style.setProperty('display', 'none');
    btn_start.style.setProperty('display', 'inline-block');
    root.style.setProperty('--cell-blur', 'blur(8px)');
    root.style.setProperty('--cell-cursor', 'default');
    display_hide_containers(all_switchers_container, 'block')
    display_hide_containers(results_container, 'none')
    find_number_title_node.style.setProperty('visibility', 'hidden')
    find_number_node.style.setProperty('visibility', 'hidden')
}

function start_schulte(){
    const root = document.documentElement;

    const ELEMENTS_ALPHABET_RU = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя'

    const TABLE_SIZE_SELECTED = document.querySelector('input[type="radio"][name="btnradio-size"]:checked').getAttribute('data-size')
    const TABLE_TYPE_SELECTED = document.querySelector('input[type="radio"][name="btnradio-type"]:checked').getAttribute('data-type')

    const TABLE_TYPE_DIGITS  = 1
	const TABLE_TYPE_LETTERS = 2
	const TABLE_TYPE_GORBOV  = 3

    const NUMBER_ELEMENTS = TABLE_SIZE_SELECTED * TABLE_SIZE_SELECTED
    let cells_data        = new Array(NUMBER_ELEMENTS)
    let straight_data     = new Array(NUMBER_ELEMENTS)

    let timer_seconds = 0
    let number_errors = 0
    
    let current_char_pos = 0

    let timer_node = document.getElementById('schulte_timer')
    find_number_title_node = document.getElementById('find_number_title')
    find_number_node = document.getElementById('find_number')

    btn_start = document.getElementById('start-button')
    btn_again = document.getElementById('again-button')
    btn_stop = document.getElementById('stop-button')
    btn_show_settings = document.getElementById('show-settings')

    switch_hint_node = document.getElementById('switch-hint')
    all_switchers_container = document.getElementsByClassName('all-switchers-container')
    results_container = document.getElementsByClassName('results-container')

    timer_node.style.setProperty('visibility', 'visible')
    
    find_number_title_node.style.setProperty('visibility', 'hidden')
	find_number_node.style.setProperty('visibility', 'hidden')

    if (!switch_hint_node.checked) {
        find_number_title_node.style.setProperty('visibility', 'visible')
        find_number_node.style.setProperty('visibility', 'visible')
    }

    btn_start.style.setProperty('display', 'none')
    btn_again.style.setProperty('display', 'none')
    btn_stop.style.setProperty('display', 'inline-block')
    btn_show_settings.style.setProperty('visibility', 'hidden')

    display_hide_containers(all_switchers_container, 'none')
    display_hide_containers(results_container, 'block')

    timer_node.innerHTML = '00:00'
    timer_id = setInterval(timer, 1000)

    switch (+TABLE_TYPE_SELECTED) {
        case TABLE_TYPE_DIGITS:
            cells_data = generate_numbers_array(NUMBER_ELEMENTS)
            find_number_title_node.innerHTML = 'Найдите число'
            console.log(cells_data)
            console.log(current_char_pos)
            break
        case TABLE_TYPE_LETTERS:
            cells_data = ELEMENTS_ALPHABET_RU.split('').slice(0, NUMBER_ELEMENTS)
            find_number_title_node.innerHTML = 'Найдите букву'
            console.log(cells_data)
            console.log(current_char_pos)
            break
        case TABLE_TYPE_GORBOV:
            cells_data = generateGorbovArray(NUMBER_ELEMENTS)
            break
    }
    
    find_number_node.innerHTML = cells_data[0]
    
    straight_data = cells_data.slice()

    kanzas_city_shuffle(cells_data);
    set_data_to_cells(cells_data, NUMBER_ELEMENTS)

    function timer() {
        timer_seconds++;
        let time_string = seconds_to_time(timer_seconds)
        timer_node.innerHTML = time_string
    }

    function seconds_to_time(total_seconds) {
        let hours   = Math.floor(total_seconds / 3600)
        let minutes = Math.floor((total_seconds - (hours * 3600)) / 60)
        let seconds = total_seconds - (hours * 3600) - (minutes * 60)

        seconds = Math.round(seconds * 100) / 100

        let time_to_show = ''
        if (hours != 0) {
            time_to_show += hours + ':'
        }
        time_to_show += (minutes < 10 ? '0' + minutes : minutes)
        time_to_show += ':' + (seconds  < 10 ? '0' + seconds : seconds)
        return time_to_show
    }

    function generate_numbers_array(size) {
		let arr = new Array(size)
		for (let i = 0; i < size; i++) {
			arr[i] = i + 1
		}
		return arr
	}

    function set_data_to_cells(data, table_size) {
        for (let i = 0; i < table_size; i++) {
            let str = '.cell[data-number="' + (i+1) + '"]'
            let cell = document.querySelector(str)
            cell.innerHTML = data[i]
            
            cell.addEventListener('click', check_click);
        }
        root.style.setProperty('--cell-blur', 'blur(0px)');
        root.style.setProperty('--cell-cursor', 'pointer');
    }

    function check_click(event) {
        let cell = event.target || event.srcElement;
        if (cell.innerHTML == '' + straight_data[current_char_pos] && current_char_pos == NUMBER_ELEMENTS - 1) {
            // stop_schulte()
            btn_stop.style.setProperty('display', 'none')
            btn_again.style.setProperty('display', 'inline-block')
            btn_show_settings.style.setProperty('visibility', 'visible')
            clearInterval(timer_id);
            blink(cell)
            find_number_title_node.style.setProperty('visibility', 'visible')
            find_number_node.style.setProperty('visibility', 'visible')
            find_number_title_node.innerHTML = 'Сделано ошибок'
            find_number_node.innerHTML = number_errors
            current_char_pos++
            console.log('Верно!!! → ' + cell.innerHTML)
        }
        if (cell.innerHTML == '' + straight_data[current_char_pos]) {
            console.log('Верно!!! → ' + cell.innerHTML);
            current_char_pos++
            find_number_node.innerHTML = straight_data[current_char_pos]
            blink(cell);
        }
        else {
            console.log('number_errors = ' + number_errors);
            number_errors++
            console.log('НЕ Верно!!! → ' + cell.innerHTML);
            console.log('number_errors = ' + number_errors);
        }
    }

    function blink(cell) {
        cell.style.setProperty('background-color','#63BE63')
            setTimeout(function() {
                cell.style.setProperty('background-color','#E9E9E9');
            }, 30)
    }

}
