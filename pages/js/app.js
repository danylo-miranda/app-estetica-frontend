const API_URL = 'http://127.0.0.1:8000/v1';

// Estado da Aplicação
let token = localStorage.getItem('access_token');

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const atendimentoForm = document.getElementById('atendimento-form');
const atendimentosList = document.getElementById('atendimentos-list');
const logoutBtn = document.getElementById('logout-btn');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setInitialDateTime();
});

function checkAuth() {
  if (token) {
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    carregarAtendimentos();
  } else {
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
}

// Preenche Data/Hora atual por padrão
function setInitialDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('data_hora').value = now.toISOString().slice(0, 16);
}

// 1. Ação Rápida de Clique nos Botões de Procedimento
document.querySelectorAll('.chip-card').forEach(chip => {
  chip.addEventListener('click', () => {
    const nome = chip.getAttribute('data-nome');
    const valor = chip.getAttribute('data-valor');

    document.getElementById('procedimento').value = nome;
    document.getElementById('valor').value = valor;
    document.getElementById('nome_paciente').focus();
  });
});

// 2. Autenticação (Login)
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-password').value;

  try {
    const response = await fetch(`${API_URL}/auth/login/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    if (!response.ok) throw new Error('Credenciais inválidas.');

    const data = await response.json();
    token = data.access_token;
    localStorage.setItem('access_token', token);
    checkAuth();
  } catch (err) {
    alert(err.message);
  }
});

// 3. Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('access_token');
  token = null;
  checkAuth();
});

// 4. Carregar Atendimentos
async function carregarAtendimentos() {
  try {
    const response = await fetch(`${API_URL}/atendimentos`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) return logoutBtn.click();

    const data = await response.json();
    renderAtendimentos(data);
  } catch (err) {
    console.error('Erro ao buscar atendimentos:', err);
  }
}

function renderAtendimentos(lista) {
  atendimentosList.innerHTML = '';
  lista.forEach(item => {
    const dataFormatada = new Date(item.data_hora).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = 'atendimento-card';
    card.innerHTML = `
      <div class="card-info">
        <h3>${item.nome_paciente}</h3>
        <p>${item.procedimento} • ${dataFormatada}</p>
      </div>
      <div class="card-action">
        <span class="price-tag">R$ ${item.valor.toFixed(2)}</span>
        <button class="btn-icon btn-delete" onclick="deletarAtendimento(${item.id})">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    atendimentosList.appendChild(card);
  });
}

// 5. Criar Atendimento
atendimentoForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    nome_paciente: document.getElementById('nome_paciente').value,
    procedimento: document.getElementById('procedimento').value,
    data_hora: new Date(document.getElementById('data_hora').value).toISOString(),
    valor: parseFloat(document.getElementById('valor').value)
  };

  try {
    const response = await fetch(`${API_URL}/atendimentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Erro ao salvar atendimento.');

    atendimentoForm.reset();
    setInitialDateTime();
    carregarAtendimentos();
  } catch (err) {
    alert(err.message);
  }
});

// 6. Deletar Atendimento
async function deletarAtendimento(id) {
  if (!confirm('Deseja realmente excluir este agendamento?')) return;

  try {
    const response = await fetch(`${API_URL}/atendimentos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) carregarAtendimentos();
  } catch (err) {
    alert('Erro ao excluir registro.');
  }
}