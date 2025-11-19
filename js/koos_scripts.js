// gen: {0: white, 1: red, 2: red-top-left, 3: red-top-right, 4: red-bottom-right, 5: red-bottom-left}
const CELL_CLASSES = ['koos-cell-white', 'koos-cell-red', 'koos-cell-topleft', 'koos-cell-topright', 'koos-cell-bottomright', 'koos-cell-bottomleft']
const IMAGE_RAND_SELECTIVE__RANDOM = 1
const TABLE_SIZE      = [[2, 2], [3, 2], [3,3]]
const MAX_NUM_CUBES   = 9
const MAX_SOLID_CUBES = 3
const INIT_TABLE_SIZE = 3

// let exercise_title_container = null
let btn_close_exercise = null
let koos_task_grid = null
let koos_cell_container_border_style = 'solid'
let grid_container_border_style = 'none'

let all_switchers_container = null
let koos_solvation_container = null
let koos_solvation_grid = null
let free_cubes_container = null
let result_container = null

let btn_start = null
let btn_again = null
let btn_show_settings = null

let cubes_array
let solvation_array
let is_cube_dragging = false
let current_droppable = null
let empty_under_current_drugging = null
let rect_empty_under_current_drugging = null

let root_doc


function ready_koos() {
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))
    btn_close_exercise = document.getElementById('close_exercise')
    koos_task_grid     = document.getElementById('koos_task_grid')

    all_switchers_container  = document.getElementsByClassName('all-switchers-container')
    koos_solvation_container = document.getElementsByClassName('koos-solvation-container')
    koos_solvation_grid      = document.getElementById('koos_solvation_grid')
    free_cubes_container     = document.getElementById('free_cubes_container')
    result_container         = document.getElementById('result_container')

    koos_solvation_grid.style.setProperty('grid-template-columns', 'repeat(' + INIT_TABLE_SIZE + ', var(--cell-size-koos))')

    btn_start = document.getElementById('start_button')
    btn_again = document.getElementById('again_button')
    btn_show_settings = document.getElementById('show_settings')

    root_doc = document.documentElement
}


function draw_koos_table(size_vert, size_hor, grid_element, /*bool*/add_cell_fill, cssname_to_select_cells, cssname_to_select_containers) {
    let grid_cells_containers = document.getElementsByName(cssname_to_select_containers)

    empty_grid_cells_array(grid_cells_containers)
    create_new_cells_for_koos_table(size_vert, size_hor, grid_element, add_cell_fill, cssname_to_select_cells, cssname_to_select_containers)

    grid_element.style.setProperty('grid-template-columns', 'repeat(' + size_hor + ', var(--cell-size-koos))')
}


function update_task_image(size_vert, size_hor) {
    draw_koos_table(size_vert, size_hor, koos_task_grid, true, 'cell__task', 'cell_container__task')
}


function create_new_cells_for_koos_table(size_vert, size_hor, grid_element, /*bool*/add_cell_fill, cssname_to_select_cells, cssname_to_select_containers) {
    let new_cell, cell_container
    let grid_size = size_hor*size_vert
    grid_element.style.visibility = 'hidden'
    for (let i = 0; i < grid_size; i++) {
        cell_container = document.createElement('div')
        cell_container.classList.add('koos-cell-container')
        cell_container.setAttribute('name', cssname_to_select_containers)

        new_cell = document.createElement('div')
        new_cell.setAttribute('name', cssname_to_select_cells)
        if (add_cell_fill) {
            if (grid_size == 9 && i == 4) {
                new_cell.classList.add('koos-cell-bottomright')
            }
            else {
                new_cell.classList.add('koos-cell-topleft')
            }
        }

        cell_container.append(new_cell)
        grid_element.append(cell_container)
    }
    grid_element.style.visibility = 'visible'
}


function set_image_cells_border_style(css_name) {
    let grid_cells_containers = document.getElementsByName(css_name)
    for(let i =0; i< grid_cells_containers.length; i++) {
        grid_cells_containers[i].style.setProperty('border-style', koos_cell_container_border_style)
        grid_cells_containers[i].style.setProperty('border-color', 'rgba(222, 226, 230, 0.4)')
        grid_cells_containers[i].style.setProperty('border-width', '1px')
    }
}


function cut_uncut_image(gap_size) {
    root_doc.style.setProperty('--cell-overflow-delta', gap_size + 'px')
}


function init_state() {
    document.addEventListener('mousedown', dnd_listener)

    init_free_cells()

    result_container.style.display = 'none'
    free_cubes_container.style.display = 'grid'
    btn_start.style.display = 'none'
    btn_again.style.display = 'none'
    btn_close_exercise.style.display = 'block'

    display_hide_containers(all_switchers_container, 'none')
    display_hide_containers(koos_solvation_container, 'flex') // не работает, если сначала переключить размер
}


function generate_arr_tiles(table_size__selected) {
    let num = TABLE_SIZE[table_size__selected][0] * TABLE_SIZE[table_size__selected][1]
    let arr = new Array(num)
    for (let i = 0; i < num; i++) {
        if (arr.filter(x => x < 2).length < MAX_SOLID_CUBES) {
            arr[i] = get_random_int(0, 5)
        }
        else{
            arr[i] = get_random_int(2, 5)
        }
    }
    return arr
}

function show_generated_cubes(cubes_array, cssname_to_select_cells, /*bool*/draggable) {
    let grid_cells = document.getElementsByName(cssname_to_select_cells)
    let draggable_class = draggable ? ' draggable' : ''
    grid_cells.forEach((cell, index) => cell.className = CELL_CLASSES[cubes_array[index]] + draggable_class)
}

function add_class_to_elems(cssname_to_select_cells, class_name) {
    let arr = document.getElementsByName(cssname_to_select_cells)
    arr.forEach(el => el.classList.add(class_name))
}

function add_data_to_elems(cssname_to_select_cells, data_name) {
    let arr = document.getElementsByName(cssname_to_select_cells)
    arr.forEach((el, index) => el.setAttribute(data_name, index))
}

function make_free_cubes_array(task_cubes_array) {
    let free_cubes_array = task_cubes_array.slice()
    for (let i = 0; i < MAX_NUM_CUBES - task_cubes_array.length; i++) {
        free_cubes_array.push(get_random_int(0, 5))
    }
    return free_cubes_array.sort(compare_numbers)
}


function start_koos() {
    const TABLE_SIZE__SELECTED = document.querySelector('input[type="radio"][name="btnradio-size"]:checked').getAttribute('data-size')
    const IMAGE_RAND_SELECTIVE__SELECTED = document.querySelector('input[type="radio"][name="btnradio-random-select"]:checked').getAttribute('data-random-select')
    const ROTATE_CUBE__SELECTED = document.querySelector('input[type="radio"][name="btnradio-rotate"]:checked').getAttribute('data-rotate')

    init_state()

    if (IMAGE_RAND_SELECTIVE__SELECTED == IMAGE_RAND_SELECTIVE__RANDOM) {
        cubes_array = generate_arr_tiles(TABLE_SIZE__SELECTED)
        console.log('tiles_array =', cubes_array);
        show_generated_cubes(cubes_array, 'cell__task', false)
    }

    draw_koos_table(TABLE_SIZE[TABLE_SIZE__SELECTED][1], TABLE_SIZE[TABLE_SIZE__SELECTED][0], koos_solvation_grid, false, 'cell__solvation', 'cell_container__solvation')
    set_image_cells_border_style('cell_container__solvation')

    let free_cubes_array = make_free_cubes_array(cubes_array)
    show_generated_cubes(free_cubes_array, 'cell__free_cube', true)

    add_class_to_elems('cell_container__solvation', 'droppable')
    add_data_to_elems('cell_container__solvation', 'data-solvation-cellindex')

    solvation_array = new Array(TABLE_SIZE[TABLE_SIZE__SELECTED][0] * TABLE_SIZE[TABLE_SIZE__SELECTED][1]).fill(-1)
}


function init_free_cells() {
    free_cubes_container.replaceChildren();

    let new_cell, cell_container, empty_cell
    let cssname_to_select_containers = 'cell_container__free_cube'
    let cssname_to_select_cells = 'cell__free_cube'


    for (let i = 0; i < 9; i++) {
        cell_container = document.createElement('div')
        cell_container.classList.add('koos-cell-container')
        cell_container.setAttribute('name', cssname_to_select_containers)

        new_cell = document.createElement('div')
        new_cell.setAttribute('name', cssname_to_select_cells)
        new_cell.setAttribute('role', 'button')
        new_cell.setAttribute('data-moved', -1)
        new_cell.classList.add('koos-cell-white', 'graggable')

        empty_cell = document.createElement('div')
        empty_cell.classList.add('koos-cell-empty')
        empty_cell.setAttribute('id', 'koos_cell_empty')

        cell_container.append(new_cell)
        cell_container.append(empty_cell)

        free_cubes_container.append(cell_container)
    }
    free_cubes_container.style.setProperty('border-style', grid_container_border_style);

}

function stop_koos() {
    init_free_cells()

    free_cubes_container.style.display = 'none'
    btn_close_exercise.style.display = 'none'
    result_container.style.display = 'none'
    btn_again.style.display = 'none'
    btn_show_settings.style.display = 'none'

    display_hide_containers(koos_solvation_container, 'none')
    display_hide_containers(all_switchers_container, 'block')
    btn_start.style.display = 'block'

    reset_task_cubes()

    document.removeEventListener('mousedown', dnd_listener)
}


function reset_task_cubes() {
    let grid_cells = document.getElementsByName('cell__task')
    grid_cells.forEach(cell => cell.className = 'koos-cell-topleft')
    if (grid_cells.length == 9) {
        grid_cells[4].className = 'koos-cell-bottomright'
    }
}


function dnd_listener(event) {
    if(event.button == 0) { // если ЛКМ
        let drag_element = event.target.closest('.draggable')
        if (!drag_element) return;

        event.preventDefault()

        let shiftX, shiftY;
        let droppable_below      = null
        drag_element.ondragstart = function() { return false }

        start_drag(drag_element, event.clientX, event.clientY)

        function on_mouse_move(event) {
            move_at(event.clientX, event.clientY)

            drag_element.hidden = true
            let elem_below = document.elementFromPoint(event.clientX, event.clientY)
            drag_element.hidden = false

            if (!elem_below) return;

            droppable_below = elem_below.closest('.droppable')
            if (current_droppable != droppable_below) {
                if (current_droppable) { // null если мы были не над droppable до этого события
                // (например, над пустым пространством)
                leave_droppable(current_droppable)
                }
                current_droppable = droppable_below
                if (current_droppable) { // null если мы не над droppable сейчас, во время этого события
                // (например, только что покинули droppable)
                enter_droppable(current_droppable)
                }
            }
        }

        function enter_droppable(elem) {
            elem.style.background = 'pink'
        }

        function leave_droppable(elem) {
            elem.style.background = ''
        }

        function on_mouse_up(event) {
            finish_drag(event);
        }

        function show_hide__empty_element(drag_element, display_option) {
            drag_element.hidden = true
            empty_under_current_drugging.style.display = display_option
            drag_element.hidden = false
        }

        function start_drag(drag_element, clientX, clientY) {
            if(is_cube_dragging) return;
            is_cube_dragging = true

            empty_under_current_drugging = drag_element.nextElementSibling
            show_hide__empty_element(drag_element, 'block')

            document.addEventListener('mousemove', on_mouse_move)
            drag_element.addEventListener('mouseup', on_mouse_up)

            // запоминаем место клика по элементу (shiftX, shiftY)
            shiftX = clientX - drag_element.getBoundingClientRect().left
            shiftY = clientY - drag_element.getBoundingClientRect().top

            drag_element.style.position = 'fixed'
            rect_empty_under_current_drugging = empty_under_current_drugging.getBoundingClientRect()
            console.log(rect_empty_under_current_drugging)

            move_at(clientX, clientY)
        };

        // переключаемся обратно на абсолютные координаты,
        // чтобы закрепить элемент относительно документа
        function finish_drag(event) {
            if(!is_cube_dragging) return;
            is_cube_dragging = false;

            // TODO: is_in_solvation_grid → ничего не делать, сейчас на первоначальное место возвращается

            let coords = get_final_coords()
            set_final_position(coords)
            console.log(drag_element.getBoundingClientRect())

            if(droppable_below) {
                drag_element.setAttribute('data-moved', 1)
                leave_droppable(droppable_below)
                let solvation_cellindex = droppable_below.getAttribute('data-solvation-cellindex')
                solvation_array[solvation_cellindex] = CELL_CLASSES.indexOf(drag_element.classList[0])
                if (!solvation_array.includes(-1)) {
                    let solved = compare_arrays(cubes_array, solvation_array)
                    if (solved) {
                        document.removeEventListener('mousedown', dnd_listener)
                        move_child_cells_to_another_parent(event)
                        free_cubes_container.style.display = 'none'
                        result_container.style.display = 'flex'
                        btn_again.style.display = 'block'
                        btn_show_settings.style.display = 'block'
                    }
                }
            }
            else {
                drag_element.setAttribute('data-moved', -1)
                show_hide__empty_element(drag_element, empty_under_current_drugging, 'none')
            }

            document.removeEventListener('mousemove', on_mouse_move)
            drag_element.removeEventListener('mouseup', on_mouse_up)
        }

        function get_final_coords() {
            let top, left, position_delete
            if(droppable_below){
                top  = droppable_below.getBoundingClientRect().top  + 'px'
                left = droppable_below.getBoundingClientRect().left + 'px'
                position_delete = false
            }
            else {
                top  = rect_empty_under_current_drugging.top + 'px'
                left = rect_empty_under_current_drugging.left + 'px'
                position_delete = true
            }
            return [top, left, position_delete]
        }

        function set_final_position(coords) {
            console.log('drag_element top & left BEFORE = ', coords)
            console.log('drag_element.style.position BEFORE = ', drag_element.style.position)

            drag_element.style.top  = coords[0]
            drag_element.style.left = coords[1]
            drag_element.style.position = 'absolute'

            console.log('drag_element top & left AFTER = ', coords)
            console.log('drag_element.style.position AFTER = ', drag_element.style.position)
            console.log('-------')
            if (coords[2] == true) {
                drag_element.style.removeProperty('position')
            }

        }

        function move_child_cells_to_another_parent(event) {
            let free_cubes        = document.getElementsByName('cell__free_cube')
            let parent_containers = document.getElementsByName('cell_container__solvation')

            let j = 0
            for(let i = 0; i < free_cubes.length; i++) {
                if (free_cubes[i].getAttribute('data-moved') == '1'){
                    parent_containers[j].append(free_cubes[i])
                    j++
                }
                free_cubes[i].removeAttribute('role')
            }
        }


        function move_at(clientX, clientY) {
            // вычисляем новые координаты (относительно окна)
            let newX = clientX - shiftX
            let newY = clientY - shiftY

            // проверяем, не переходят ли новые координаты за нижний край окна
            let new_bottom = newY + drag_element.offsetHeight

            // затем, если новый край окна выходит за пределы документа, прокручиваем страницу
            if (new_bottom > document.documentElement.clientHeight) {
                // координата нижнего края документа относительно окна
                let doc_bottom = document.documentElement.getBoundingClientRect().bottom
                let my_scrollY = Math.min(doc_bottom - new_bottom, 10)

                if (my_scrollY < 0) my_scrollY = 0
                window.scrollBy(0, my_scrollY)

                // быстрое перемещение мыши может поместить курсор за пределы документа вниз
                // если это произошло -
                // ограничиваем новое значение Y исходя из размера документа:
                newY = Math.min(newY, document.documentElement.clientHeight - drag_element.offsetHeight)
            }

            // проверяем, не переходят ли новые координаты за верхний край окна
            if (newY < 0) {
                // прокручиваем окно вверх
                let my_scrollY = Math.min(-newY, 10)
                if (my_scrollY < 0) my_scrollY = 0
                window.scrollBy(0, -my_scrollY)
                newY = Math.max(newY, 0)
            }

            // ограничим newX размерами окна
            if (newX < 0) newX = 0
            if (newX > document.documentElement.clientWidth - drag_element.offsetWidth) {
                newX = document.documentElement.clientWidth - drag_element.offsetWidth
            }

            drag_element.style.left = newX + 'px'
            drag_element.style.top  = newY + 'px'
        }
    }
}
