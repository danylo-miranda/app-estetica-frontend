const API_URL = 'https://api-age.dsm.tec.br/v1';

// Estado da Aplicação
let token = localStorage.getItem('access_token');
let skipAtendimentos = 0;
const limitAtendimentos = 10;

// Elementos DOM Principais
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const atendimentoForm = document.getElementById('atendimento-form');
const atendimentosList = document.getElementById('atendimentos-list');
const logoutBtn = document.getElementById('logout-btn');

// Função auxiliar para cabeçalho autenticado
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setInitialDateTime();
  configurarChips();

  if (loginForm) loginForm.addEventListener('submit', realizarLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', realizarLogout);
  if (atendimentoForm) atendimentoForm.addEventListener('submit', salvarAgendamento);
});

// Verificação de Autenticação
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

// Data e Hora Local padrão no input
function setInitialDateTime() {
  const campo = document.getElementById('data_hora');
  if (campo) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    campo.value = now.toISOString().slice(0, 16);
  }
}

// Preenchimento rápido via Chips (Procedimentos)
function configurarChips() {
  document.querySelectorAll('.chip-card').forEach(chip => {
    chip.addEventListener('click', () => {
      const nome = chip.getAttribute('data-nome');
      const valor = chip.getAttribute('data-valor');

      document.getElementById('procedimento').value = nome;
      document.getElementById('valor').value = valor;
      document.getElementById('nome_paciente').focus();
    });
  });
}

// 1. Autenticação (Login/Logout)
async function realizarLogin(e) {
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
}

function realizarLogout() {
  localStorage.removeItem('access_token');
  token = null;
  checkAuth();
}

// 2. Navegação de Telas (SPA / Menu Lateral)
function navegar(tela, event) {
  document.querySelectorAll('.tab-content').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${tela}`);
  if (targetView) targetView.classList.add('active');

  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  if (tela === 'dashboard') inicializarFiltrosDashboard();
  if (tela === 'atendimentos') carregarAtendimentos();
  if (tela === 'clientes') carregarClientes();
}

// 3. Agendamento Rápido (Formato de data corrigido para o Python/SQLite)
async function salvarAgendamento(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const nome = document.getElementById('nome_paciente')?.value;
  const procedimento = document.getElementById('procedimento')?.value;
  const dataHoraVal = document.getElementById('data_hora')?.value;
  const valorVal = document.getElementById('valor')?.value;

  if (!nome || !procedimento || !dataHoraVal || !valorVal) {
    alert('Por favor, preencha todos os campos do agendamento.');
    return;
  }

  // Garante o formato 'YYYY-MM-DDTHH:MM:SS' sem o sufixo 'Z'
  const dataFormatada = dataHoraVal.length === 16 ? `${dataHoraVal}:00` : dataHoraVal;

  const payload = {
    nome_paciente: nome,
    procedimento: procedimento,
    data_hora: dataFormatada,
    valor: parseFloat(valorVal)
  };

  try {
    const response = await fetch(`${API_URL}/atendimentos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      alert('Sessão expirada. Faça login novamente.');
      return realizarLogout();
    }

    if (!response.ok) {
      const errDetail = await response.text();
      alert(`Erro no backend (${response.status}): ${errDetail}`);
      return;
    }

    alert('Atendimento agendado com sucesso!');
    const form = document.getElementById('atendimento-form');
    if (form) form.reset();
    setInitialDateTime();
    carregarAtendimentos();
  } catch (err) {
    console.error('Erro de conexão:', err);
    alert('Erro ao se comunicar com o servidor.');
  }
}

// 4. Lista Paginada de Atendimentos
async function carregarAtendimentos() {
  try {
    const response = await fetch(`${API_URL}/atendimentos?skip=${skipAtendimentos}&limit=${limitAtendimentos}`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) return realizarLogout();

    const data = await response.json();
    renderAtendimentos(data);

    const paginaAtual = Math.floor(skipAtendimentos / limitAtendimentos) + 1;
    const infoPagina = document.getElementById('atendimentos-pagina-info');
    if (infoPagina) infoPagina.innerText = `Página ${paginaAtual}`;
  } catch (err) {
    console.error('Erro ao buscar atendimentos:', err);
  }
}

function renderAtendimentos(lista) {
  if (!atendimentosList) return;
  atendimentosList.innerHTML = '';

  if (lista.length === 0) {
    atendimentosList.innerHTML = `<p style="padding: 15px; color: #666;">Nenhum agendamento encontrado.</p>`;
    return;
  }

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
        <button class="btn-icon btn-delete" title="Excluir" onclick="deletarAtendimento(${item.id})">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    atendimentosList.appendChild(card);
  });
}

function mudarPaginaAtendimentos(delta) {
  if (delta === -1 && skipAtendimentos >= limitAtendimentos) {
    skipAtendimentos -= limitAtendimentos;
    carregarAtendimentos();
  } else if (delta === 1) {
    skipAtendimentos += limitAtendimentos;
    carregarAtendimentos();
  }
}

async function deletarAtendimento(id) {
  if (!confirm('Deseja realmente excluir este agendamento?')) return;

  try {
    const response = await fetch(`${API_URL}/atendimentos/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.status === 401) return realizarLogout();
    if (response.ok) carregarAtendimentos();
  } catch (err) {
    alert('Erro ao excluir registro.');
  }
}

// 5. Dashboard
function inicializarFiltrosDashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const inputInicio = document.getElementById('dash-inicio');
  const inputFim = document.getElementById('dash-fim');

  if (inputInicio && !inputInicio.value) inputInicio.value = hoje;
  if (inputFim && !inputFim.value) inputFim.value = hoje;

  carregarDashboard();
}

async function carregarDashboard() {
  const inicio = document.getElementById('dash-inicio').value;
  const fim = document.getElementById('dash-fim').value;

  try {
    const res = await fetch(`${API_URL}/dashboard/metricas?data_inicio=${inicio}&data_fim=${fim}`, {
      headers: getAuthHeaders()
    });

    if (res.status === 401) return realizarLogout();

    if (res.ok) {
      const dados = await res.json();
      document.getElementById('kpi-atendimentos').innerText = dados.total_atendimentos;
      document.getElementById('kpi-faturamento').innerText = `R$ ${dados.faturamento_total.toFixed(2)}`;
      document.getElementById('kpi-ticket').innerText = `R$ ${dados.ticket_medio.toFixed(2)}`;
    }
  } catch (err) {
    console.error('Erro ao carregar métricas:', err);
  }
}

// 6. Clientes e Fichas de Anamnese
async function salvarCliente(e) {
  e.preventDefault();

  const payload = {
    nome: document.getElementById('cli-nome').value,
    telefone: document.getElementById('cli-telefone').value,
    email: document.getElementById('cli-email').value,
    ficha_avaliacao: document.getElementById('cli-ficha').value
  };

  try {
    const res = await fetch(`${API_URL}/clientes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (res.status === 401) return realizarLogout();

    if (res.ok) {
      alert('Cliente cadastrado com sucesso!');
      document.getElementById('cliente-form').reset();
      carregarClientes();
    } else {
      alert('Erro ao cadastrar cliente.');
    }
  } catch (err) {
    console.error('Erro ao salvar cliente:', err);
  }
}

async function carregarClientes(nome = '') {
  const url = nome ? `${API_URL}/clientes?nome=${encodeURIComponent(nome)}` : `${API_URL}/clientes?skip=0&limit=50`;

  try {
    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.status === 401) return realizarLogout();

    if (res.ok) {
      const clientes = await res.json();
      const container = document.getElementById('clientes-list');
      if (!container) return;

      if (clientes.length === 0) {
        container.innerHTML = `<p style="padding: 15px; color: #666;">Nenhum cliente cadastrado.</p>`;
        return;
      }

      container.innerHTML = clientes.map(c => `
        <div class="atendimento-card">
          <div class="card-info">
            <h3>${c.nome}</h3>
            <p>📞 ${c.telefone || 'Não informado'} | ✉️ ${c.email || 'Não informado'}</p>
          </div>
          <div class="card-action">
            <button type="button" class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" 
              onclick="alert('Ficha de Anamnese de ${c.nome.replace(/'/g, "\\'")}:\\n\\n${(c.ficha_avaliacao || 'Nenhuma observação cadastrada.').replace(/'/g, "\\'")}')">
              Ver Ficha
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
  }
}

function buscarClientes() {
  const termo = document.getElementById('cli-busca').value;
  carregarClientes(termo);
}