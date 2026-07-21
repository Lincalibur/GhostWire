import { api } from '../api.js';

/**
 * Wire the gatekeeper login + OTP flow.
 * @param {(handle: string) => void} onAuthorized callback invoked on success
 * @returns {void}
 */
export function initPortal(onAuthorized) {
  const loginStep = document.getElementById('login-form-step');
  const otpStep = document.getElementById('otp-form-step');
  const operatorInput = document.getElementById('operator-id');
  const passwordInput = document.getElementById('operator-pass');
  const otpInput = document.getElementById('otp-token');
  const errorEl = document.getElementById('portal-error');
  const channelNote = document.getElementById('otp-channel-note');
  const btnOperator = document.getElementById('btn-submit-operator');
  const btnOtp = document.getElementById('btn-submit-otp');

  let handle = '';

  const setError = (msg) => {
    errorEl.textContent = msg || '';
    errorEl.style.display = msg ? 'block' : 'none';
  };

  const setBusy = (btn, busy, label) => {
    btn.disabled = busy;
    btn.textContent = busy ? '... TRANSMITTING' : label;
  };

  async function submitOperator() {
    setError('');
    handle = operatorInput.value.trim();
    const password = passwordInput.value;
    if (!handle || !password) {
      setError('OPERATOR ID AND PASSPHRASE REQUIRED');
      return;
    }

    setBusy(btnOperator, true, 'Submit Operator ID');
    try {
      const res = await api.auth.login(handle, password);
      loginStep.classList.add('hidden');
      otpStep.classList.remove('hidden');
      channelNote.textContent = `TOKEN ROUTED VIA ${String(res.channel).toUpperCase()} CHANNEL`;
      otpInput.focus();
    } catch (err) {
      setError(`ACCESS DENIED: ${err.message}`);
    } finally {
      setBusy(btnOperator, false, 'Submit Operator ID');
    }
  }

  async function submitOtp() {
    setError('');
    const otp = otpInput.value.trim();
    if (!otp) {
      setError('DYNAMIC TOKEN REQUIRED');
      return;
    }

    setBusy(btnOtp, true, 'Verify Operator Token');
    try {
      const res = await api.auth.verify(handle, otp);
      onAuthorized(res.operator.handle);
    } catch (err) {
      setError(`ACCESS DENIED: ${err.message}`);
    } finally {
      setBusy(btnOtp, false, 'Verify Operator Token');
    }
  }

  btnOperator.addEventListener('click', submitOperator);
  btnOtp.addEventListener('click', submitOtp);
  operatorInput.addEventListener('keydown', (e) => e.key === 'Enter' && passwordInput.focus());
  passwordInput.addEventListener('keydown', (e) => e.key === 'Enter' && submitOperator());
  otpInput.addEventListener('keydown', (e) => e.key === 'Enter' && submitOtp());
}
