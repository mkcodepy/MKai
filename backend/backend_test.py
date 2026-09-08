"""
Comprehensive Backend API Test Suite for AtendeAI Console
Tests all endpoints with focus on AI assistant functionality, knowledge base, and conversations.
"""
import requests
import json
import time
import sys

BASE_URL = "https://customer-ai-platform-3.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class BackendTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.assistant_id = None
        self.conversation_id = None
        self.knowledge_source_id = None
        self.failed_tests = []
        
    def log(self, message, color=Colors.BLUE):
        print(f"{color}{message}{Colors.END}")
        
    def test(self, name, method, endpoint, expected_status, data=None, files=None, 
             timeout=30, validate_fn=None):
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        self.tests_run += 1
        
        print(f"\n{'='*80}")
        self.log(f"🔍 Test #{self.tests_run}: {name}", Colors.BLUE)
        self.log(f"   {method} {endpoint}", Colors.BLUE)
        
        try:
            if method == 'GET':
                response = requests.get(url, timeout=timeout)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, timeout=timeout)
                else:
                    response = requests.post(url, json=data, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, timeout=timeout)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, timeout=timeout)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Check status code
            status_ok = response.status_code == expected_status
            
            # Try to parse JSON
            try:
                response_data = response.json()
            except Exception:
                response_data = response.text
            
            # Run custom validation if provided
            validation_ok = True
            validation_msg = ""
            if validate_fn and status_ok:
                validation_ok, validation_msg = validate_fn(response_data)
            
            # Determine overall success
            success = status_ok and validation_ok
            
            if success:
                self.tests_passed += 1
                self.log("✅ PASSED", Colors.GREEN)
                self.log(f"   Status: {response.status_code} (expected {expected_status})", Colors.GREEN)
                if validation_msg:
                    self.log(f"   {validation_msg}", Colors.GREEN)
            else:
                self.tests_failed += 1
                self.failed_tests.append(name)
                self.log("❌ FAILED", Colors.RED)
                if not status_ok:
                    self.log(f"   Status: {response.status_code} (expected {expected_status})", Colors.RED)
                if not validation_ok:
                    self.log(f"   Validation failed: {validation_msg}", Colors.RED)
                self.log(f"   Response: {json.dumps(response_data, indent=2)[:500]}", Colors.YELLOW)
            
            return success, response_data
            
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append(name)
            self.log(f"❌ FAILED - Exception: {str(e)}", Colors.RED)
            return False, {}
    
    def run_all_tests(self):
        """Execute all backend tests"""
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("🚀 Starting AtendeAI Backend API Test Suite", Colors.BLUE)
        self.log("="*80 + "\n", Colors.BLUE)
        
        # 1. Test root endpoint
        self.test("Root API endpoint", "GET", "", 200,
                  validate_fn=lambda r: (r.get("status") == "ok", f"Status: {r.get('status')}"))
        
        # 2. Test meta/models endpoint
        success, models_data = self.test(
            "Get available models and providers", 
            "GET", "meta/models", 200,
            validate_fn=lambda r: (
                "providers" in r and "defaults" in r and 
                "openai" in r["providers"] and "anthropic" in r["providers"] and "gemini" in r["providers"],
                f"Providers: {list(r.get('providers', {}).keys())}, Defaults: {r.get('defaults', {})}"
            )
        )
        
        # 3. Test list assistants (should have seed data)
        success, assistants_data = self.test(
            "List assistants (check seed data)", 
            "GET", "assistants", 200,
            validate_fn=lambda r: (
                isinstance(r, list) and len(r) > 0 and 
                any(a.get("name") == "Nova — TechNova" for a in r),
                f"Found {len(r)} assistant(s), seed 'Nova — TechNova' present: {any(a.get('name') == 'Nova — TechNova' for a in r)}"
            )
        )
        
        # Verify seed assistant has knowledge_count=3
        if success and assistants_data:
            nova_assistant = next((a for a in assistants_data if a.get("name") == "Nova — TechNova"), None)
            if nova_assistant:
                self.assistant_id = nova_assistant["id"]
                kb_count = nova_assistant.get("knowledge_count", 0)
                if kb_count == 3:
                    self.log("   ✅ Seed assistant has knowledge_count=3", Colors.GREEN)
                else:
                    self.log(f"   ⚠️  Seed assistant has knowledge_count={kb_count} (expected 3)", Colors.YELLOW)
        
        # 4. Create a new assistant
        new_assistant_data = {
            "name": "Test Assistant",
            "description": "Test assistant for API testing",
            "provider": "openai",
            "model": "gpt-5.4",
            "language": "Português (Brasil)",
            "personality": "Amigável e prestativo",
            "tone": "Profissional",
            "role_instructions": "Ajude os clientes com suas dúvidas",
            "rules": ["Seja claro", "Seja conciso"],
            "business_objectives": "Satisfação do cliente",
            "greeting": "Olá! Como posso ajudar?",
            "fallback": "Desculpe, não entendi.",
            "handoff_rules": "Escale quando necessário",
            "kb_strict": True,
            "temperature": 0.7
        }
        success, created_assistant = self.test(
            "Create new assistant",
            "POST", "assistants", 200,
            data=new_assistant_data,
            validate_fn=lambda r: (
                "id" in r and r.get("name") == "Test Assistant",
                f"Created assistant with ID: {r.get('id')}"
            )
        )
        
        test_assistant_id = created_assistant.get("id") if success else None
        
        # 5. Get specific assistant
        if test_assistant_id:
            self.test(
                "Get specific assistant by ID",
                "GET", f"assistants/{test_assistant_id}", 200,
                validate_fn=lambda r: (
                    r.get("id") == test_assistant_id and r.get("name") == "Test Assistant",
                    f"Retrieved assistant: {r.get('name')}"
                )
            )
        
        # 6. Update assistant
        if test_assistant_id:
            update_data = {"name": "Updated Test Assistant", "temperature": 0.8}
            self.test(
                "Update assistant",
                "PUT", f"assistants/{test_assistant_id}", 200,
                data=update_data,
                validate_fn=lambda r: (
                    r.get("name") == "Updated Test Assistant" and r.get("temperature") == 0.8,
                    f"Updated name: {r.get('name')}, temperature: {r.get('temperature')}"
                )
            )
        
        # 7. Test knowledge base - add text source
        if self.assistant_id:
            text_knowledge = {
                "assistant_id": self.assistant_id,
                "title": "Teste de Conhecimento",
                "content": "Este é um teste de base de conhecimento. A empresa oferece suporte 24/7 e tem política de devolução de 15 dias.",
                "type": "text"
            }
            success, kb_response = self.test(
                "Add text knowledge source",
                "POST", "knowledge/text", 200,
                data=text_knowledge,
                validate_fn=lambda r: (
                    "id" in r and r.get("status") == "indexed" and r.get("chunk_count", 0) > 0,
                    f"Indexed with {r.get('chunk_count')} chunks, status: {r.get('status')}"
                )
            )
            
            if success:
                self.knowledge_source_id = kb_response.get("id")
        
        # 8. Test file upload - create a test TXT file
        if self.assistant_id:
            test_file_content = b"Informacoes de teste para upload de arquivo.\nA empresa aceita pagamento via Pix, cartao e boleto.\nO prazo de entrega e de 5 a 7 dias uteis."
            files = {'file': ('test_knowledge.txt', test_file_content, 'text/plain')}
            data = {'assistant_id': self.assistant_id}
            
            success, upload_response = self.test(
                "Upload knowledge file (TXT)",
                "POST", "knowledge/upload", 200,
                data=data,
                files=files,
                validate_fn=lambda r: (
                    "id" in r and r.get("status") == "indexed" and r.get("type") == "file",
                    f"File uploaded and indexed with {r.get('chunk_count')} chunks"
                )
            )
        
        # 9. List knowledge sources
        if self.assistant_id:
            self.test(
                "List knowledge sources for assistant",
                "GET", f"knowledge?assistant_id={self.assistant_id}", 200,
                validate_fn=lambda r: (
                    isinstance(r, list) and len(r) >= 3,  # At least 3 from seed
                    f"Found {len(r)} knowledge source(s)"
                )
            )
        
        # 10. Create a conversation
        if self.assistant_id:
            conv_data = {
                "channel": "simulator",
                "contact_name": "Cliente Teste",
                "contact_phone": "+5511999999999",
                "assistant_id": self.assistant_id
            }
            success, conv_response = self.test(
                "Create conversation",
                "POST", "conversations", 200,
                data=conv_data,
                validate_fn=lambda r: (
                    "id" in r and r.get("status") == "bot" and not r.get("ai_paused"),
                    f"Created conversation ID: {r.get('id')}, status: {r.get('status')}"
                )
            )
            
            if success:
                self.conversation_id = conv_response.get("id")
        
        # 11. Test AI response with KB fidelity
        if self.conversation_id:
            self.log("\n⏳ Testing AI response (this may take 10-15 seconds)...", Colors.YELLOW)
            inbound_data = {"text": "Qual o prazo de troca e reembolso?"}
            success, ai_response = self.test(
                "Send customer message and get AI response (KB fidelity test)",
                "POST", f"conversations/{self.conversation_id}/inbound", 200,
                data=inbound_data,
                timeout=30,
                validate_fn=lambda r: (
                    "customer_message" in r and "assistant_message" in r and 
                    r.get("assistant_message") is not None,
                    f"AI responded: {r.get('assistant_message', {}).get('text', '')[:100]}..."
                )
            )
            
            # Check if response mentions 30 days and 10 days (from seed KB)
            if success and ai_response.get("assistant_message"):
                ai_text = ai_response["assistant_message"].get("text", "").lower()
                has_30_days = "30" in ai_text
                has_10_days = "10" in ai_text
                if has_30_days and has_10_days:
                    self.log("   ✅ AI response is faithful to KB (mentions 30 days and 10 days)", Colors.GREEN)
                else:
                    self.log(f"   ⚠️  AI response may not be fully faithful to KB (30 days: {has_30_days}, 10 days: {has_10_days})", Colors.YELLOW)
        
        # 12. Test handoff detection
        if self.conversation_id:
            # Create a new conversation for handoff test
            conv_data = {
                "channel": "simulator",
                "contact_name": "Cliente Insatisfeito",
                "contact_phone": "+5511888888888",
                "assistant_id": self.assistant_id
            }
            success, handoff_conv = self.test(
                "Create conversation for handoff test",
                "POST", "conversations", 200,
                data=conv_data
            )
            
            if success:
                handoff_conv_id = handoff_conv.get("id")
                self.log("\n⏳ Testing handoff detection (this may take 10-15 seconds)...", Colors.YELLOW)
                
                # Send message requesting human
                handoff_data = {"text": "Quero falar com um atendente humano agora!"}
                success, handoff_response = self.test(
                    "Test handoff detection (request human)",
                    "POST", f"conversations/{handoff_conv_id}/inbound", 200,
                    data=handoff_data,
                    timeout=30,
                    validate_fn=lambda r: (
                        r.get("assistant_message") is not None and 
                        r.get("assistant_message", {}).get("handoff"),
                        f"Handoff detected: {r.get('assistant_message', {}).get('handoff')}"
                    )
                )
                
                # Verify conversation status changed to human and ai_paused=true
                if success:
                    time.sleep(1)  # Give it a moment to update
                    success, conv_status = self.test(
                        "Verify conversation status after handoff",
                        "GET", f"conversations/{handoff_conv_id}", 200,
                        validate_fn=lambda r: (
                            r.get("status") == "human" and r.get("ai_paused") and r.get("handoff"),
                            f"Status: {r.get('status')}, AI paused: {r.get('ai_paused')}, Handoff: {r.get('handoff')}"
                        )
                    )
        
        # 13. Test AI pause/resume
        if self.conversation_id:
            # Pause AI
            self.test(
                "Pause AI (set ai_paused=true)",
                "PATCH", f"conversations/{self.conversation_id}/status", 200,
                data={"ai_paused": True},
                validate_fn=lambda r: (
                    r.get("ai_paused"),
                    f"AI paused: {r.get('ai_paused')}"
                )
            )
            
            # Send message while paused - should NOT get AI response
            paused_data = {"text": "Esta mensagem não deve gerar resposta da IA"}
            success, paused_response = self.test(
                "Send message while AI paused (should NOT get AI response)",
                "POST", f"conversations/{self.conversation_id}/inbound", 200,
                data=paused_data,
                validate_fn=lambda r: (
                    r.get("assistant_message") is None,
                    f"AI response (should be None): {r.get('assistant_message')}"
                )
            )
            
            # Resume AI
            self.test(
                "Resume AI (set ai_paused=false)",
                "PATCH", f"conversations/{self.conversation_id}/status", 200,
                data={"ai_paused": False},
                validate_fn=lambda r: (
                    not r.get("ai_paused") and r.get("status") == "bot",
                    f"AI paused: {r.get('ai_paused')}, Status: {r.get('status')}"
                )
            )
        
        # 14. Test human message (should NOT trigger AI)
        if self.conversation_id:
            human_data = {"text": "Olá, sou um atendente humano. Como posso ajudar?"}
            success, human_response = self.test(
                "Send human message (should NOT trigger AI)",
                "POST", f"conversations/{self.conversation_id}/human", 200,
                data=human_data,
                validate_fn=lambda r: (
                    "id" in r and r.get("role") == "human" and r.get("text") == human_data["text"],
                    f"Human message saved with role: {r.get('role')}"
                )
            )
        
        # 15. List conversations
        self.test(
            "List all conversations",
            "GET", "conversations", 200,
            validate_fn=lambda r: (
                isinstance(r, list) and len(r) > 0,
                f"Found {len(r)} conversation(s)"
            )
        )
        
        # 16. Get conversation with messages
        if self.conversation_id:
            self.test(
                "Get conversation with messages",
                "GET", f"conversations/{self.conversation_id}", 200,
                validate_fn=lambda r: (
                    "messages" in r and isinstance(r["messages"], list),
                    f"Conversation has {len(r.get('messages', []))} message(s)"
                )
            )
        
        # 17. Test playground streaming (basic check - we can't fully test SSE here)
        if self.assistant_id:
            self.log("\n⏳ Testing playground streaming (this may take 10-15 seconds)...", Colors.YELLOW)
            playground_data = {
                "assistant_id": self.assistant_id,
                "session_id": f"test-session-{int(time.time())}",
                "message": "Olá, qual o horário de atendimento?"
            }
            
            # For SSE, we just check if the endpoint responds
            try:
                url = f"{BASE_URL}/playground/stream"
                response = requests.post(url, json=playground_data, stream=True, timeout=30)
                
                self.tests_run += 1
                print(f"\n{'='*80}")
                self.log(f"🔍 Test #{self.tests_run}: Test playground streaming (SSE)", Colors.BLUE)
                
                if response.status_code == 200:
                    # Read first few chunks
                    chunks_received = 0
                    for chunk in response.iter_lines():
                        if chunk:
                            chunks_received += 1
                            if chunks_received >= 5:  # Just verify we get some data
                                break
                    
                    if chunks_received > 0:
                        self.tests_passed += 1
                        self.log(f"✅ PASSED - Received {chunks_received} SSE chunks", Colors.GREEN)
                    else:
                        self.tests_failed += 1
                        self.failed_tests.append("Test playground streaming (SSE)")
                        self.log("❌ FAILED - No SSE chunks received", Colors.RED)
                else:
                    self.tests_failed += 1
                    self.failed_tests.append("Test playground streaming (SSE)")
                    self.log(f"❌ FAILED - Status: {response.status_code}", Colors.RED)
                    
            except Exception as e:
                self.tests_failed += 1
                self.failed_tests.append("Test playground streaming (SSE)")
                self.log(f"❌ FAILED - Exception: {str(e)}", Colors.RED)
        
        # 18. Test WhatsApp status
        self.test(
            "Get WhatsApp status",
            "GET", "whatsapp/status", 200,
            validate_fn=lambda r: (
                "status" in r and r.get("status") in ["disconnected", "connecting", "connected"],
                f"WhatsApp status: {r.get('status')}, mode: {r.get('mode')}"
            )
        )
        
        # 19. Test WhatsApp connect
        success, connect_response = self.test(
            "Connect WhatsApp (generate QR)",
            "POST", "whatsapp/connect", 200,
            validate_fn=lambda r: (
                r.get("status") == "connecting" and "qr" in r and r.get("qr") is not None,
                f"Status: {r.get('status')}, QR generated: {r.get('qr') is not None}"
            )
        )
        
        # 20. Test WhatsApp disconnect
        self.test(
            "Disconnect WhatsApp",
            "POST", "whatsapp/disconnect", 200,
            validate_fn=lambda r: (
                r.get("status") == "disconnected" and r.get("qr") is None,
                f"Status: {r.get('status')}, QR cleared: {r.get('qr') is None}"
            )
        )
        
        # 21. Test assistant templates
        success, templates_data = self.test(
            "Get assistant templates",
            "GET", "assistants/templates", 200,
            validate_fn=lambda r: (
                isinstance(r, list) and len(r) == 6 and 
                any(t.get("key") == "ecommerce" for t in r),
                f"Found {len(r)} templates, ecommerce present: {any(t.get('key') == 'ecommerce' for t in r)}"
            )
        )
        
        # 22. Test specific template detail
        self.test(
            "Get ecommerce template detail",
            "GET", "assistants/templates/ecommerce", 200,
            validate_fn=lambda r: (
                "config" in r and "suggested_knowledge" in r and 
                r.get("config", {}).get("name") == "Nova — Loja",
                f"Template config name: {r.get('config', {}).get('name')}, has suggested_knowledge: {'suggested_knowledge' in r}"
            )
        )
        
        # 23. Test generate assistant config with AI (short description should fail)
        self.test(
            "Generate assistant config with short description (should fail)",
            "POST", "assistants/generate", 400,
            data={"description": "loja", "provider": "openai"},
            validate_fn=lambda r: (
                True,  # Just checking 400 status
                "Short description rejected"
            )
        )
        
        # 24. Test generate assistant config with AI (valid description)
        self.log("\n⏳ Testing AI assistant generation (this may take 10-40 seconds)...", Colors.YELLOW)
        generate_data = {
            "description": "Assistente para uma clínica veterinária que atende cães e gatos, oferece consultas, vacinas, cirurgias e banho e tosa. Horário de atendimento: segunda a sexta das 8h às 18h.",
            "provider": "openai"
        }
        success, generated_config = self.test(
            "Generate assistant config with AI",
            "POST", "assistants/generate", 200,
            data=generate_data,
            timeout=60,
            validate_fn=lambda r: (
                all(k in r for k in ["name", "mission", "skills", "few_shot_examples", "suggested_knowledge"]) and
                isinstance(r.get("skills"), list) and len(r.get("skills", [])) >= 5 and
                isinstance(r.get("few_shot_examples"), list) and len(r.get("few_shot_examples", [])) >= 1,
                f"Generated config with name: {r.get('name')}, {len(r.get('skills', []))} skills, {len(r.get('few_shot_examples', []))} examples"
            )
        )
        
        # 25. Test compiled prompt endpoint
        if self.assistant_id:
            self.test(
                "Get compiled prompt for assistant",
                "GET", f"assistants/{self.assistant_id}/prompt?sample=Olá, qual o horário?", 200,
                validate_fn=lambda r: (
                    "prompt" in r and "sources" in r and "# IDENTIDADE E MISSÃO" in r.get("prompt", "") and
                    "[[META:" in r.get("prompt", ""),
                    f"Prompt length: {r.get('chars')} chars, approx {r.get('approx_tokens')} tokens, {len(r.get('sources', []))} sources"
                )
            )
        
        # 26. Test evaluate endpoint
        if self.assistant_id:
            self.log("\n⏳ Testing assistant evaluation (this may take 20-60 seconds)...", Colors.YELLOW)
            eval_data = {
                "questions": [
                    "Vocês parcelam em quantas vezes?",
                    "Qual o prazo de entrega?"
                ]
            }
            success, eval_response = self.test(
                "Evaluate assistant with test questions",
                "POST", f"assistants/{self.assistant_id}/evaluate", 200,
                data=eval_data,
                timeout=90,
                validate_fn=lambda r: (
                    "summary" in r and "results" in r and 
                    r.get("summary", {}).get("total") == 2 and
                    all("meta" in res for res in r.get("results", []) if "error" not in res),
                    f"Evaluated {r.get('summary', {}).get('total')} questions, avg confidence: {r.get('summary', {}).get('avg_confidence')}, kb_used_rate: {r.get('summary', {}).get('kb_used_rate')}%"
                )
            )
        
        # 27. Test duplicate assistant
        if test_assistant_id:
            success, dup_response = self.test(
                "Duplicate assistant",
                "POST", f"assistants/{test_assistant_id}/duplicate?with_knowledge=true", 200,
                validate_fn=lambda r: (
                    "id" in r and r.get("id") != test_assistant_id and 
                    "(cópia)" in r.get("name", ""),
                    f"Duplicated assistant ID: {r.get('id')}, name: {r.get('name')}"
                )
            )
            
            if success:
                dup_assistant_id = dup_response.get("id")
                # Clean up duplicate
                self.test(
                    "Delete duplicated assistant",
                    "DELETE", f"assistants/{dup_assistant_id}", 200
                )
        
        # 28. Test assistant stats
        if self.assistant_id:
            self.test(
                "Get assistant statistics",
                "GET", f"assistants/{self.assistant_id}/stats", 200,
                validate_fn=lambda r: (
                    all(k in r for k in ["conversations", "handoffs", "resolved", "ai_messages", "handoff_rate"]),
                    f"Stats: {r.get('conversations')} conversations, {r.get('handoffs')} handoffs, {r.get('handoff_rate')}% handoff rate"
                )
            )
        
        # 29. Test knowledge QnA type (should create 1 chunk per Q&A pair)
        if self.assistant_id:
            qna_knowledge = {
                "assistant_id": self.assistant_id,
                "title": "FAQ Teste",
                "content": "P: Qual o horário de atendimento?\nR: Atendemos de segunda a sexta das 9h às 18h.\n\nP: Aceitam cartão?\nR: Sim, aceitamos todas as bandeiras.",
                "type": "qna"
            }
            success, qna_response = self.test(
                "Add QnA knowledge source (should create 1 chunk per pair)",
                "POST", "knowledge/text", 200,
                data=qna_knowledge,
                validate_fn=lambda r: (
                    "id" in r and r.get("type") == "qna" and r.get("chunk_count") == 2,
                    f"QnA indexed with {r.get('chunk_count')} chunks (expected 2 for 2 Q&A pairs)"
                )
            )
            
            if success:
                qna_source_id = qna_response.get("id")
                
                # 30. Test knowledge search with full_context
                search_data = {
                    "assistant_id": self.assistant_id,
                    "query": "vocês parcelam?",
                    "top_k": 5
                }
                self.test(
                    "Search knowledge base",
                    "POST", "knowledge/search", 200,
                    data=search_data,
                    validate_fn=lambda r: (
                        "results" in r and "total_chunks" in r and "full_context" in r and
                        isinstance(r.get("results"), list),
                        f"Search returned {len(r.get('results', []))} results, total_chunks: {r.get('total_chunks')}, full_context: {r.get('full_context')}"
                    )
                )
                
                # 31. Test get knowledge source with chunks
                self.test(
                    "Get knowledge source with chunks",
                    "GET", f"knowledge/{qna_source_id}", 200,
                    validate_fn=lambda r: (
                        "chunks" in r and isinstance(r.get("chunks"), list) and len(r.get("chunks")) == 2,
                        f"Source has {len(r.get('chunks', []))} chunks"
                    )
                )
                
                # 32. Test update knowledge source
                update_kb_data = {
                    "assistant_id": self.assistant_id,
                    "title": "FAQ Atualizado",
                    "content": "P: Qual o horário?\nR: 9h às 18h.",
                    "type": "qna"
                }
                self.test(
                    "Update knowledge source",
                    "PUT", f"knowledge/{qna_source_id}", 200,
                    data=update_kb_data,
                    validate_fn=lambda r: (
                        r.get("title") == "FAQ Atualizado" and r.get("chunk_count") == 1,
                        f"Updated title: {r.get('title')}, chunks: {r.get('chunk_count')}"
                    )
                )
                
                # 33. Test reindex knowledge source
                self.test(
                    "Reindex knowledge source",
                    "POST", f"knowledge/{qna_source_id}/reindex", 200,
                    validate_fn=lambda r: (
                        "chunk_count" in r,
                        f"Reindexed with {r.get('chunk_count')} chunks"
                    )
                )
                
                # Clean up QnA source
                self.test(
                    "Delete QnA knowledge source",
                    "DELETE", f"knowledge/{qna_source_id}", 200
                )
        
        # 34. Test knowledge URL with invalid URL (should fail)
        if self.assistant_id:
            invalid_url_data = {
                "assistant_id": self.assistant_id,
                "url": "not-a-valid-url"
            }
            self.test(
                "Add knowledge from invalid URL (should fail)",
                "POST", "knowledge/url", 400,
                data=invalid_url_data,
                validate_fn=lambda r: (
                    True,  # Just checking 400 status
                    "Invalid URL rejected"
                )
            )
        
        # 35. Test conversation with metadata extraction
        if self.assistant_id:
            # Create new conversation for metadata test
            conv_data = {
                "channel": "simulator",
                "contact_name": "Bruno Silva",
                "contact_phone": "+5511977770000",
                "assistant_id": self.assistant_id
            }
            success, meta_conv = self.test(
                "Create conversation for metadata test",
                "POST", "conversations", 200,
                data=conv_data
            )
            
            if success:
                meta_conv_id = meta_conv.get("id")
                self.log("\n⏳ Testing metadata extraction (this may take 10-15 seconds)...", Colors.YELLOW)
                
                # Send message that should extract customer profile
                meta_data = {"text": "oi, sou o Bruno. vocês parcelam?"}
                success, meta_response = self.test(
                    "Send message with customer name (should extract profile)",
                    "POST", f"conversations/{meta_conv_id}/inbound", 200,
                    data=meta_data,
                    timeout=30,
                    validate_fn=lambda r: (
                        r.get("assistant_message") is not None and
                        "meta" in r.get("assistant_message", {}),
                        "AI responded with metadata"
                    )
                )
                
                if success and meta_response.get("assistant_message"):
                    ai_msg = meta_response["assistant_message"]
                    meta = ai_msg.get("meta", {})
                    
                    # Check metadata fields
                    has_intent = "intent" in meta
                    has_sentiment = "sentiment" in meta
                    has_confidence = "confidence" in meta
                    has_kb_used = "kb_used" in meta
                    has_tags = "tags" in meta
                    
                    if all([has_intent, has_sentiment, has_confidence, has_kb_used, has_tags]):
                        self.log(f"   ✅ Metadata complete: intent={meta.get('intent')}, sentiment={meta.get('sentiment')}, confidence={meta.get('confidence')}, kb_used={meta.get('kb_used')}, tags={meta.get('tags')}", Colors.GREEN)
                    else:
                        self.log(f"   ⚠️  Metadata incomplete: intent={has_intent}, sentiment={has_sentiment}, confidence={has_confidence}, kb_used={has_kb_used}, tags={has_tags}", Colors.YELLOW)
                    
                    # Check if sources are present
                    if "sources" in ai_msg and len(ai_msg["sources"]) > 0:
                        self.log(f"   ✅ Response includes {len(ai_msg['sources'])} knowledge sources", Colors.GREEN)
                    
                    # Check latency_ms
                    if "latency_ms" in ai_msg:
                        self.log(f"   ✅ Latency tracked: {ai_msg['latency_ms']}ms", Colors.GREEN)
                
                # Get conversation to check customer_profile
                time.sleep(1)
                success, conv_detail = self.test(
                    "Get conversation to verify customer profile extraction",
                    "GET", f"conversations/{meta_conv_id}", 200,
                    validate_fn=lambda r: (
                        "customer_profile" in r,
                        f"Customer profile: {r.get('customer_profile', {})}"
                    )
                )
                
                if success and conv_detail.get("customer_profile"):
                    profile = conv_detail["customer_profile"]
                    if "nome" in profile and "bruno" in profile.get("nome", "").lower():
                        self.log("   ✅ Customer profile extracted name: Bruno", Colors.GREEN)
                    else:
                        self.log(f"   ⚠️  Customer profile may not have extracted name correctly: {profile}", Colors.YELLOW)
                
                # 36. Test follow-up message (should use context)
                self.log("\n⏳ Testing context retention (this may take 10-15 seconds)...", Colors.YELLOW)
                followup_data = {"text": "e o prazo?"}
                success, followup_response = self.test(
                    "Send follow-up message (should use context)",
                    "POST", f"conversations/{meta_conv_id}/inbound", 200,
                    data=followup_data,
                    timeout=30,
                    validate_fn=lambda r: (
                        r.get("assistant_message") is not None,
                        "AI responded to follow-up"
                    )
                )
                
                if success and followup_response.get("assistant_message"):
                    followup_text = followup_response["assistant_message"].get("text", "").lower()
                    # Should mention delivery time (2-4 dias úteis from seed KB)
                    if "dia" in followup_text or "prazo" in followup_text or "entrega" in followup_text:
                        self.log("   ✅ AI understood context and responded about delivery time", Colors.GREEN)
                    else:
                        self.log(f"   ⚠️  AI response may not have used context correctly: {followup_text[:100]}", Colors.YELLOW)
                
                # 37. Test copilot (suggest reply)
                self.log("\n⏳ Testing copilot suggestion (this may take 10-15 seconds)...", Colors.YELLOW)
                success, suggest_response = self.test(
                    "Get copilot suggestion for agent",
                    "POST", f"conversations/{meta_conv_id}/suggest", 200,
                    timeout=30,
                    validate_fn=lambda r: (
                        "suggestion" in r and "sources" in r and len(r.get("suggestion", "")) > 0,
                        f"Copilot suggested: {r.get('suggestion', '')[:80]}..."
                    )
                )
                
                # 38. Test briefing
                self.log("\n⏳ Testing briefing generation (this may take 10-15 seconds)...", Colors.YELLOW)
                success, briefing_response = self.test(
                    "Generate briefing for agent handoff",
                    "POST", f"conversations/{meta_conv_id}/briefing", 200,
                    timeout=30,
                    validate_fn=lambda r: (
                        all(k in r for k in ["summary", "customer_goal", "sentiment", "open_points", "suggested_next_step"]),
                        f"Briefing: {r.get('summary', '')[:80]}..., sentiment: {r.get('sentiment')}"
                    )
                )
                
                # 39. Test notes and tags
                notes_data = {
                    "notes": "Cliente interessado em parcelamento",
                    "tags": ["parcelamento", "interessado"]
                }
                self.test(
                    "Update conversation notes and tags",
                    "PATCH", f"conversations/{meta_conv_id}/notes", 200,
                    data=notes_data,
                    validate_fn=lambda r: (
                        r.get("notes") == notes_data["notes"] and 
                        set(r.get("tags", [])) == set(notes_data["tags"]),
                        f"Notes: {r.get('notes')}, Tags: {r.get('tags')}"
                    )
                )
                
                # Clean up metadata test conversation
                self.test(
                    "Delete metadata test conversation",
                    "DELETE", f"conversations/{meta_conv_id}", 200
                )
        
        # 40. Test WhatsApp settings
        wa_settings_data = {
            "assistant_id": self.assistant_id,
            "auto_reply": True,
            "debounce_ms": 3000,
            "reply_delay_ms": 2000,
            "split_long_messages": True,
            "ignore_groups": True
        }
        self.test(
            "Update WhatsApp settings",
            "PATCH", "whatsapp/settings", 200,
            data=wa_settings_data,
            validate_fn=lambda r: (
                r.get("auto_reply") and 
                r.get("debounce_ms") == 3000 and
                r.get("reply_delay_ms") == 2000,
                f"Settings: auto_reply={r.get('auto_reply')}, debounce={r.get('debounce_ms')}ms, delay={r.get('reply_delay_ms')}ms"
            )
        )
        
        # 41. Test WhatsApp get settings
        self.test(
            "Get WhatsApp settings",
            "GET", "whatsapp/settings", 200,
            validate_fn=lambda r: (
                all(k in r for k in ["auto_reply", "debounce_ms", "reply_delay_ms", "split_long_messages", "ignore_groups"]),
                f"Settings retrieved: {r}"
            )
        )
        
        # 42. Test WhatsApp inbound simulation
        if self.assistant_id:
            self.log("\n⏳ Testing WhatsApp inbound (this may take 10-15 seconds)...", Colors.YELLOW)
            wa_inbound_data = {
                "phone": "+5511977770000",
                "name": "Maria Silva",
                "text": "qual o horário de atendimento?"
            }
            success, wa_response = self.test(
                "WhatsApp inbound message (first time - creates conversation)",
                "POST", "whatsapp/inbound", 200,
                data=wa_inbound_data,
                timeout=30,
                validate_fn=lambda r: (
                    "reply" in r and "conversation_id" in r and r.get("reply") is not None,
                    f"Reply: {r.get('reply', '')[:80]}..., conversation_id: {r.get('conversation_id')}"
                )
            )
            
            if success:
                wa_conv_id = wa_response.get("conversation_id")
                
                # 43. Test WhatsApp inbound reuses conversation
                wa_inbound_data2 = {
                    "phone": "+5511977770000",
                    "name": "Maria Silva",
                    "text": "e vocês aceitam pix?"
                }
                self.log("\n⏳ Testing WhatsApp inbound reuse (this may take 10-15 seconds)...", Colors.YELLOW)
                success, wa_response2 = self.test(
                    "WhatsApp inbound message (same phone - reuses conversation)",
                    "POST", "whatsapp/inbound", 200,
                    data=wa_inbound_data2,
                    timeout=30,
                    validate_fn=lambda r: (
                        r.get("conversation_id") == wa_conv_id,
                        f"Reused conversation_id: {r.get('conversation_id')}"
                    )
                )
                
                # Clean up WhatsApp conversation
                if wa_conv_id:
                    self.test(
                        "Delete WhatsApp test conversation",
                        "DELETE", f"conversations/{wa_conv_id}", 200
                    )
        
        # 44. Test conversation filters
        self.test(
            "List conversations with status filter",
            "GET", "conversations?status=human", 200,
            validate_fn=lambda r: (
                isinstance(r, list),
                f"Found {len(r)} conversation(s) with status=human"
            )
        )
        
        self.test(
            "List conversations with channel filter",
            "GET", "conversations?channel=simulator", 200,
            validate_fn=lambda r: (
                isinstance(r, list),
                f"Found {len(r)} conversation(s) with channel=simulator"
            )
        )
        
        # 45. Test dashboard stats with new fields
        self.test(
            "Get dashboard statistics (v2 with new fields)",
            "GET", "dashboard/stats", 200,
            validate_fn=lambda r: (
                all(k in r for k in ["assistants", "conversations", "messages", "knowledge_sources", 
                                     "handoff_rate", "ai_resolution_rate", "avg_latency_ms", "avg_confidence",
                                     "sentiment", "intents", "timeline", "per_assistant", "recent"]) and
                isinstance(r.get("sentiment"), dict) and
                isinstance(r.get("intents"), list) and
                isinstance(r.get("timeline"), list) and len(r.get("timeline", [])) == 7 and
                isinstance(r.get("per_assistant"), list),
                f"Stats: {r.get('assistants')} assistants, {r.get('conversations')} conversations, ai_resolution_rate: {r.get('ai_resolution_rate')}%, avg_latency: {r.get('avg_latency_ms')}ms, avg_confidence: {r.get('avg_confidence')}, sentiment: {r.get('sentiment')}, {len(r.get('intents', []))} intents, {len(r.get('timeline', []))} timeline days, {len(r.get('per_assistant', []))} assistants"
            )
        )
        
        # 46. Delete knowledge source
        if self.knowledge_source_id:
            self.test(
                "Delete knowledge source",
                "DELETE", f"knowledge/{self.knowledge_source_id}", 200,
                validate_fn=lambda r: (
                    r.get("ok"),
                    "Knowledge source deleted"
                )
            )
        
        # 47. Delete conversation
        if self.conversation_id:
            self.test(
                "Delete conversation",
                "DELETE", f"conversations/{self.conversation_id}", 200,
                validate_fn=lambda r: (
                    r.get("ok"),
                    "Conversation deleted"
                )
            )
        
        # 48. Delete test assistant
        if test_assistant_id:
            self.test(
                "Delete assistant",
                "DELETE", f"assistants/{test_assistant_id}", 200,
                validate_fn=lambda r: (
                    r.get("ok"),
                    "Assistant deleted"
                )
            )
        
        # Print summary
        self.print_summary()
        
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        self.log("📊 TEST SUMMARY", Colors.BLUE)
        print("="*80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"\nTotal Tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}", Colors.GREEN)
        self.log(f"Failed: {self.tests_failed}", Colors.RED)
        
        if success_rate >= 90:
            color = Colors.GREEN
        elif success_rate >= 70:
            color = Colors.YELLOW
        else:
            color = Colors.RED
        
        self.log(f"Success Rate: {success_rate:.1f}%", color)
        
        if self.failed_tests:
            self.log("\n❌ Failed Tests:", Colors.RED)
            for test in self.failed_tests:
                print(f"   - {test}")
        
        print("\n" + "="*80 + "\n")
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = BackendTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
