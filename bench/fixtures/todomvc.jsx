import { Component, linkEvent } from 'inferno';

var ENTER_KEY = 13;
var ESCAPE_KEY = 27;
var FILTERS = {
  all: function () {
    return true;
  },
  active: function (todo) {
    return !todo.completed;
  },
  completed: function (todo) {
    return todo.completed;
  }
};

function pluralize(count, word) {
  return count === 1 ? word : word + 's';
}

function onToggle(props) {
  props.onToggle(props.todo);
}

function onDestroy(props) {
  props.onDestroy(props.todo);
}

class TodoItem extends Component {
  constructor(props) {
    super(props);
    this.state = {editText: props.todo.title};
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleInput = this.handleInput.bind(this);
  }

  handleSubmit() {
    var value = this.state.editText.trim();

    if (value) {
      this.props.onSave(this.props.todo, value);
      this.setState({editText: value});
    } else {
      this.props.onDestroy(this.props.todo);
    }
  }

  handleKeyDown(event) {
    if (event.which === ESCAPE_KEY) {
      this.setState({editText: this.props.todo.title});
      this.props.onCancel(event);
    } else if (event.which === ENTER_KEY) {
      this.handleSubmit(event);
    }
  }

  handleInput(event) {
    this.setState({editText: event.target.value});
  }

  render({todo, editing, onEdit}) {
    var className = (todo.completed ? 'completed' : '') + (editing ? ' editing' : '');

    return (
      <li className={className}>
        <div className="view">
          <input
            className="toggle"
            type="checkbox"
            checked={todo.completed}
            onChange={linkEvent(this.props, onToggle)}
          />
          <label onDoubleClick={linkEvent(todo, onEdit)}>{todo.title}</label>
          <button className="destroy" onClick={linkEvent(this.props, onDestroy)} />
        </div>
        {editing && (
          <input
            ref={(node) => node && node.focus()}
            className="edit"
            value={this.state.editText}
            onBlur={this.handleSubmit}
            onInput={this.handleInput}
            onKeyDown={this.handleKeyDown}
            autoFocus
          />
        )}
      </li>
    );
  }
}

function Footer({count, completedCount, nowShowing, onClearCompleted}) {
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{count}</strong> {pluralize(count, 'item')} left
      </span>
      <ul className="filters">
        <li>
          <a href="#/" className={nowShowing === 'all' ? 'selected' : ''}>All</a>
        </li>
        {' '}
        <li>
          <a href="#/active" className={nowShowing === 'active' ? 'selected' : ''}>Active</a>
        </li>
        {' '}
        <li>
          <a href="#/completed" className={nowShowing === 'completed' ? 'selected' : ''}>Completed</a>
        </li>
      </ul>
      {completedCount > 0 ? (
        <button className="clear-completed" onClick={onClearCompleted}>
          Clear completed
        </button>
      ) : null}
    </footer>
  );
}

export class TodoApp extends Component {
  constructor(props) {
    super(props);
    this.state = {nowShowing: 'all', editing: null, newTodo: ''};
  }

  handleNewTodoKeyDown(event) {
    if (event.keyCode !== ENTER_KEY) {
      return;
    }
    event.preventDefault();

    var value = this.state.newTodo.trim();

    if (value) {
      this.props.model.addTodo(value);
      this.setState({newTodo: ''});
    }
  }

  render() {
    var model = this.props.model;
    var todos = model.todos;
    var shownTodos = todos.filter(FILTERS[this.state.nowShowing]);
    var activeCount = todos.reduce(function (count, todo) {
      return todo.completed ? count : count + 1;
    }, 0);
    var completedCount = todos.length - activeCount;
    var self = this;

    return (
      <div>
        <header className="header">
          <h1>todos</h1>
          <input
            className="new-todo"
            placeholder="What needs to be done?"
            value={this.state.newTodo}
            onKeyDown={(event) => this.handleNewTodoKeyDown(event)}
            onInput={(event) => this.setState({newTodo: event.target.value})}
            autoFocus
          />
        </header>
        {todos.length > 0 && (
          <section className="main">
            <input
              id="toggle-all"
              className="toggle-all"
              type="checkbox"
              onChange={(event) => model.toggleAll(event.target.checked)}
              checked={activeCount === 0}
            />
            <label htmlFor="toggle-all">Mark all as complete</label>
            <ul className="todo-list" $HasKeyedChildren>
              {shownTodos.map(function (todo) {
                return (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={model.toggle}
                    onDestroy={model.destroy}
                    onEdit={(item) => self.setState({editing: item.id})}
                    editing={self.state.editing === todo.id}
                    onSave={model.save}
                    onCancel={() => self.setState({editing: null})}
                  />
                );
              })}
            </ul>
          </section>
        )}
        {activeCount || completedCount ? (
          <Footer
            count={activeCount}
            completedCount={completedCount}
            nowShowing={this.state.nowShowing}
            onClearCompleted={() => model.clearCompleted()}
          />
        ) : null}
      </div>
    );
  }
}
