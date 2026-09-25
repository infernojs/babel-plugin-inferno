import { Component, Fragment } from 'inferno';
import { ChildFlags } from 'inferno-vnode-flags';
import { Chart, Icon, Menu, Pagination, Spinner } from './widgets';

var COLUMNS = [
  {key: 'name', title: 'Name', sortable: true},
  {key: 'status', title: 'Status', sortable: true},
  {key: 'owner', title: 'Owner', sortable: false},
  {key: 'updated', title: 'Updated', sortable: true},
  {key: 'cost', title: 'Cost', sortable: true}
];

function StatusBadge({status}) {
  return <span className={'badge badge-' + status} title={status} $HasTextChildren>{status}</span>;
}

function Cell({column, row}) {
  switch (column.key) {
  case 'status':
    return <td className="cell cell-status"><StatusBadge status={row.status} /></td>;
  case 'owner':
    return (
      <td className="cell cell-owner">
        <img className="avatar" src={row.owner.avatar} alt="" width={24} height={24} />
        {row.owner.name}
      </td>
    );
  case 'cost':
    return <td className="cell cell-number" style={{textAlign: 'right'}}>{row.cost.toFixed(2)} €</td>;
  default:
    return <td className="cell" children={row[column.key]} />;
  }
}

function HeaderCell({column, sort, onSort}) {
  var active = sort.key === column.key;

  return (
    <th
      className={active ? 'sorted ' + sort.direction : ''}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={column.sortable ? () => onSort(column.key) : null}
      tabIndex={column.sortable ? 0 : -1}
      scope="col"
    >
      {column.title}
      {column.sortable && <Icon name={active && sort.direction === 'desc' ? 'arrow-down' : 'arrow-up'} />}
    </th>
  );
}

function Row({row, selected, onSelect, ...rest}) {
  return (
    <tr className={selected ? 'row selected' : 'row'} onClick={() => onSelect(row.id)} {...rest} $HasNonKeyedChildren>
      <td className="cell cell-check">
        <input type="checkbox" checked={selected} readOnly />
      </td>
      {COLUMNS.map((column) => <Cell column={column} row={row} />)}
      <td className="cell cell-actions">
        <Menu
          items={[
            {label: 'Open', href: '/items/' + row.id},
            {label: 'Duplicate', action: 'duplicate'},
            {label: 'Archive', action: 'archive'}
          ]}
        >
          <Icon name="more" />
        </Menu>
      </td>
    </tr>
  );
}

function SummaryTile({label, value, delta, children}) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className={delta >= 0 ? 'tile-delta up' : 'tile-delta down'}>
        {delta >= 0 ? '+' : ''}{delta}%
      </div>
      {children}
    </div>
  );
}

export class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {sort: {key: 'updated', direction: 'desc'}, selected: {}, page: 0};
    this.onSort = this.onSort.bind(this);
    this.onSelect = this.onSelect.bind(this);
  }

  onSort(key) {
    var sort = this.state.sort;

    this.setState({sort: {key: key, direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc'}});
  }

  onSelect(id) {
    var selected = Object.assign({}, this.state.selected);

    selected[id] = !selected[id];
    this.setState({selected: selected});
  }

  renderSummary(summary) {
    return (
      <>
        <SummaryTile label="Projects" value={summary.projects} delta={summary.projectsDelta} />
        <SummaryTile label="Active" value={summary.active} delta={summary.activeDelta}>
          <Chart type="sparkline" data={summary.activeHistory} height={32} />
        </SummaryTile>
        <SummaryTile label="Monthly cost" value={summary.cost + ' €'} delta={summary.costDelta}>
          <Chart type="bar" data={summary.costHistory} height={32} colors={['#4c6ef5', '#adb5bd']} />
        </SummaryTile>
      </>
    );
  }

  renderTable(rows) {
    var self = this;
    var state = this.state;

    return (
      <table className="table" cellPadding={0} cellSpacing={0}>
        <colgroup>
          <col width={32} />
          {COLUMNS.map((column) => <col key={column.key} className={'col-' + column.key} />)}
          <col width={48} />
        </colgroup>
        <thead>
          <tr $HasKeyedChildren>
            <th key="check" />
            {COLUMNS.map((column) => (
              <HeaderCell key={column.key} column={column} sort={state.sort} onSort={self.onSort} />
            ))}
            <th key="actions" />
          </tr>
        </thead>
        <tbody $ChildFlag={rows.length > 0 ? ChildFlags.HasKeyedChildren : ChildFlags.HasInvalidChildren}>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              selected={Boolean(state.selected[row.id])}
              onSelect={self.onSelect}
              data-id={row.id}
              aria-selected={Boolean(state.selected[row.id])}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={COLUMNS.length + 2}>
              <Pagination page={state.page} pages={Math.ceil(this.props.total / 50)} onChange={(page) => self.setState({page: page})} />
            </td>
          </tr>
        </tfoot>
      </table>
    );
  }

  render({rows, summary, loading, error, ...props}) {
    return (
      <div className="dashboard" {...props}>
        <header className="dashboard-header">
          <h1>Projects</h1>
          <div className="toolbar" role="toolbar">
            <button className="btn" onClick={this.props.onRefresh} disabled={loading}>
              <Icon name="refresh" /> Refresh
            </button>
            <button className="btn btn-primary" onClick={this.props.onCreate}>
              <Icon name="plus" /> New project
            </button>
          </div>
        </header>
        <section className="summary" $ReCreate>
          {this.renderSummary(summary)}
        </section>
        {error ? (
          <div className="alert alert-error" role="alert">
            <Icon name="warning" />
            <Fragment key="error">
              <strong>Could not load the projects.</strong> {error.message}
            </Fragment>
          </div>
        ) : null}
        {loading ? <Spinner size="large" /> : this.renderTable(rows)}
      </div>
    );
  }
}
