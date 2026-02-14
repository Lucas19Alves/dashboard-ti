<template>
  <div class="p-8">
    <div class="flex items-center gap-3 mb-6">
      <i class="fas fa-server text-3xl text-green-600"></i>
      <h1 class="text-4xl font-bold text-gray-800">Sistemas</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Sistema 1 -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold text-gray-800">ERP Principal</h3>
            <p class="text-gray-600 text-sm">Sistema de Gestão</p>
          </div>
          <i class="fas fa-check-circle text-green-500 text-2xl"></i>
        </div>
        <div class="space-y-2">
          <p class="text-sm text-gray-600"><strong>Status:</strong> <span class="text-green-600">Online</span></p>
          <p class="text-sm text-gray-600"><strong>Uptime:</strong> 99.9%</p>
          <p class="text-sm text-gray-600"><strong>Versão:</strong> 2.1.5</p>
        </div>
      </div>

      <!-- Sistema 2 -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold text-gray-800">Database Server</h3>
            <p class="text-gray-600 text-sm">Banco de Dados</p>
          </div>
          <i class="fas fa-check-circle text-green-500 text-2xl"></i>
        </div>
        <div class="space-y-2">
          <p class="text-sm text-gray-600"><strong>Status:</strong> <span class="text-green-600">Online</span></p>
          <p class="text-sm text-gray-600"><strong>Espaço Livre:</strong> 450 GB</p>
          <p class="text-sm text-gray-600"><strong>Versão:</strong> 12.4</p>
        </div>
      </div>

      <!-- Sistema 3 -->
      <div class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold text-gray-800">Web API</h3>
            <p class="text-gray-600 text-sm">Serviços REST</p>
          </div>
          <i class="fas fa-exclamation-circle text-yellow-500 text-2xl"></i>
        </div>
        <div class="space-y-2">
          <p class="text-sm text-gray-600"><strong>Status:</strong> <span class="text-yellow-600">Atenção</span></p>
          <p class="text-sm text-gray-600"><strong>CPU:</strong> 78%</p>
          <p class="text-sm text-gray-600"><strong>Versão:</strong> 1.8.2</p>
        </div>
      </div>
    </div>
  </div>
</template>
