import { Component, createRef, RefObject } from 'inferno';

type FieldType = 'text' | 'email' | 'password' | 'number';

interface FieldProps<T> {
  name: keyof T & string;
  label: string;
  type?: FieldType;
  value: T[keyof T];
  error?: string;
  required?: boolean;
  maxLength?: number;
  onChange: (name: keyof T, value: string) => void;
}

interface SignupValues {
  name: string;
  email: string;
  password: string;
  age: number;
  bio: string;
  country: string;
}

interface SignupState {
  values: SignupValues;
  errors: Partial<Record<keyof SignupValues, string>>;
  submitting: boolean;
}

const COUNTRIES: ReadonlyArray<{code: string; name: string}> = [
  {code: 'fi', name: 'Finland'},
  {code: 'se', name: 'Sweden'},
  {code: 'no', name: 'Norway'},
  {code: 'dk', name: 'Denmark'},
  {code: 'ee', name: 'Estonia'}
];

function Field<T>({name, label, type = 'text', value, error, required, maxLength, onChange}: FieldProps<T>) {
  const id = 'field-' + name;

  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="required" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value as unknown as string}
        maxLength={maxLength}
        autoComplete={type === 'password' ? 'new-password' : 'on'}
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        onInput={(event: Event) => onChange(name, (event.target as HTMLInputElement).value)}
      />
      {error ? <p id={id + '-error'} className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

function CountrySelect({value, onChange}: {value: string; onChange: (value: string) => void}) {
  return (
    <div className="field">
      <label htmlFor="field-country" className="field-label">Country</label>
      <select id="field-country" value={value} onChange={(event: Event) => onChange((event.target as HTMLSelectElement).value)}>
        <option value="">Choose&hellip;</option>
        {COUNTRIES.map((country) => (
          <option key={country.code} value={country.code}>{country.name}</option>
        ))}
      </select>
    </div>
  );
}

export class SignupForm extends Component<{onSubmit: (values: SignupValues) => Promise<void>}, SignupState> {
  private formRef: RefObject<HTMLFormElement> = createRef();

  state: SignupState = {
    values: {name: '', email: '', password: '', age: 18, bio: '', country: ''},
    errors: {},
    submitting: false
  };

  private handleChange = (name: keyof SignupValues, value: string): void => {
    this.setState({values: {...this.state.values, [name]: value}});
  };

  private validate(values: SignupValues): SignupState['errors'] {
    const errors: SignupState['errors'] = {};

    if (!values.name) {
      errors.name = 'Please tell us your name.';
    }
    if (!/^[^@]+@[^@]+$/.test(values.email)) {
      errors.email = 'That does not look like an email address.';
    }
    if (values.password.length < 12) {
      errors.password = 'Use at least 12 characters.';
    }
    return errors;
  }

  private handleSubmit = async (event: Event): Promise<void> => {
    event.preventDefault();
    const errors = this.validate(this.state.values);

    this.setState({errors});
    if (Object.keys(errors).length === 0) {
      this.setState({submitting: true});
      await this.props.onSubmit(this.state.values);
      this.setState({submitting: false});
    }
  };

  render() {
    const {values, errors, submitting} = this.state;

    return (
      <form ref={this.formRef} className="signup" noValidate onSubmit={this.handleSubmit}>
        <fieldset disabled={submitting}>
          <legend>Create your account</legend>
          <Field<SignupValues> name="name" label="Name" value={values.name} error={errors.name} required onChange={this.handleChange} />
          <Field<SignupValues> name="email" label="Email" type="email" value={values.email} error={errors.email} required onChange={this.handleChange} />
          <Field<SignupValues> name="password" label="Password" type="password" value={values.password} error={errors.password} required maxLength={128} onChange={this.handleChange} />
          <Field<SignupValues> name="age" label="Age" type="number" value={values.age} onChange={this.handleChange} />
          <CountrySelect value={values.country} onChange={(value) => this.handleChange('country', value)} />
          <div className="field">
            <label htmlFor="field-bio" className="field-label">About you</label>
            <div
              id="field-bio"
              className="rich-text"
              contentEditable
              role="textbox"
              aria-multiline="true"
              tabIndex={0}
              onInput={(event: Event) => this.handleChange('bio', (event.target as HTMLElement).innerText)}
              $HasTextChildren
            >
              {values.bio}
            </div>
          </div>
          <label className="checkbox">
            <input type="checkbox" name="terms" required />
            I accept the <a href="/terms" target="_blank">terms of service</a>
          </label>
        </fieldset>
        <div className="actions">
          <button type="submit" className="btn btn-primary" onDoubleClick={(event: Event) => event.preventDefault()}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
          <Spinner visible={submitting} onComponentDidMount={(node: Element) => node.scrollIntoView()} />
        </div>
      </form>
    );
  }
}

declare function Spinner(props: {visible: boolean}): JSX.Element;
