import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  DollarSign, 
  Bot, 
  User, 
  HelpCircle,
  Loader2,
  FileText,
  BadgeAlert
} from 'lucide-react';
import { ERPData } from '../types';

interface AIConsultantViewProps {
  erpData: ERPData;
}

export const AIConsultantView: React.FC<AIConsultantViewProps> = ({ erpData }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; date: string }>>([
    {
      sender: 'bot',
      text: `Xin chào! Tôi là **S-ERP AI Consultant** - cố vấn thông thái của bạn. 

Tôi có quyền kết nối thời gian thực tới dữ liệu Kho hàng, Đơn hàng, Trạng thái CRM và Ngân sách tài chính của bạn.

**Bạn muốn tôi giúp phân tích điều gì hôm nay?** Bạn có thể gõ câu hỏi tự do hoặc chọn nhanh các đề xuất phân tích thông minh ở cột bên cạnh để bắt đầu ngay!`,
      date: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Quick prompt templates grounded on real business state
  const promptTemplates = [
    {
      title: "Phân tích doanh thu & tối ưu CRM",
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      question: "Hãy dựa vào doanh thu hoàn thành, các khách hàng hiện có và những kênh đặt hàng để lập báo cáo đánh giá xu thế tăng trưởng tài chính và đề xuất chiến lược tiếp cận chăm sóc khách hàng VIP để đạt đột phá.",
      instruction: "Bạn là chuyên gia kinh tế trưởng kiêm Giám đốc Tài chiến. Hãy phân tích các mã đơn hàng DHxxx, tính tổng giá trị hoàn thành và đưa ra lộ trình khai phá khách hàng trung thành."
    },
    {
      title: "Cảnh báo rủi ro đứt gãy tồn kho",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      question: "Hãy rà soát danh sách sản phẩm trong kho, phát hiện các sản phẩm có số lượng ở dưới hoặc bằng mức an toàn (minThreshold) và lập một danh sách đề xuất số lượng hàng cần nhập bổ sung kèm dự toán chi phí.",
      instruction: "Bạn là trưởng bộ phận quản trị chuỗi cung ứng. Hãy phân tích mức độ thiếu hụt sản phẩm, chỉ ra vị trí kệ cụ thể và ước tính số vốn nhập kho cần đầu tư gấp."
    },
    {
      title: "Báo cáo tối ưu lực lượng nhân sự",
      icon: <Users className="h-4 w-4 text-blue-500" />,
      question: "Dựa vào danh sách nhân sự hiện tại, hãy lập báo cáo phân bố phòng ban tuyển dụng, chi phí quỹ lương trung bình của từng phòng ban và đề xuất phương án cải thiện nâng năng suất làm việc nhóm.",
      instruction: "Bạn là Giám đốc Nhân sự (CHRO). Hãy bóc tách chi phí lương của Kinh doanh, Kỹ thuật, Kế toán và Kho vận, đánh giá các nhân sự đang nghỉ phép và đưa ra tư vấn điều phối nguồn lực năng suất."
    },
    {
      title: "Kiểm toán dòng tiền & rủi ro thu chi",
      icon: <DollarSign className="h-4 w-4 text-rose-500" />,
      question: "Hãy phân tích sổ giao dịch Thu Chi (Transactions). Cho tôi biết các khoản chi trả lương và thuê văn phòng có giữ tỉ lệ cân đối so với doanh thu hoàn thành hay chưa, cảnh báo nếu dòng tiền ròng đang bị âm.",
      instruction: "Bạn là kiểm toán viên nội bộ chuyên nghiệp. Hãy tính toán chi tiết tổng tiền thu và tổng tiền chi từ dữ liệu ledger, chỉ ra các giao dịch lớn và đưa ra lời khuyên quản trị tài chính an toàn."
    }
  ];

  // Send request to server-side Gemini
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || userInput;
    if (!textToSend.trim() || isLoading) return;

    // Add user message
    const formattedTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user' as const, text: textToSend, date: formattedTime };
    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsLoading(true);

    // Look if text matches a template's instruction
    const matchedTemplate = promptTemplates.find(p => p.question === textToSend);
    const systemCommand = matchedTemplate ? matchedTemplate.instruction : undefined;

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemCommand,
          erpData,
          userQuestion: textToSend
        })
      });

      const data = await response.json();
      if (data.success && data.text) {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: data.text,
          date: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        throw new Error(data.error || 'Trục trặc phản hồi từ trí tuệ AI');
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: `**Lỗi hệ thống:** Không thể kết nối được với Trợ lý AI. Vui lòng kiểm tra lại cấu hình khoá secrets GEMINI_API_KEY ở settings hoặc thử lại sau.\n\n*Chi tiết kỹ thuật: ${error.message || 'Server timeout'}*`,
        date: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe markdown-like direct text renderer directly to JSX for rich rendering (no extra packages required)
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      
      // Determine if a heading
      if (content.startsWith('### ')) {
        return <h5 key={idx} className="text-gray-900 font-bold text-sm mt-3 mb-1.5 flex items-center gap-1.5 border-b border-gray-150 pb-1">{content.slice(4)}</h5>;
      }
      if (content.startsWith('## ')) {
        return <h4 key={idx} className="text-indigo-900 font-bold text-base mt-4 mb-2 flex items-center gap-1.5">{content.slice(3)}</h4>;
      }
      if (content.startsWith('# ')) {
        return <h3 key={idx} className="text-indigo-950 font-extrabold text-lg mt-5 mb-2">{content.slice(2)}</h3>;
      }

      // Check if item lists
      if (content.startsWith('- ') || content.startsWith('* ')) {
        const listText = content.slice(2);
        return (
          <div key={idx} className="pl-4 -indent-4 text-xs text-gray-700 leading-relaxed mb-1 pr-1.5">
            <span className="text-indigo-500 font-bold scale-125 inline-block mr-2">●</span>
            {parseBoldText(listText)}
          </div>
        );
      }

      // Separator lines
      if (content.trim() === '---') {
        return <hr key={idx} className="my-3 border-gray-150" />;
      }

      // Regular paragraph or line
      return (
        <p key={idx} className="text-xs text-gray-700 leading-relaxed min-h-[0.75rem] mb-1.5">
          {parseBoldText(content)}
        </p>
      );
    });
  };

  // Sub helper to format **bold** strings dynamically
  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, i) => {
      // Every odd element is bold
      if (i % 2 === 1) {
        return <strong key={i} className="font-extrabold text-gray-900">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="ai-bi-center-root">
      
      {/* Selection Left Rail */}
      <div className="lg:col-span-1 space-y-4" id="ai-suggestion-rail">
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-5 space-y-3.5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 h-28 w-28 bg-indigo-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Tính năng cao cấp</span>
          </div>
          
          <h3 className="font-bold text-base leading-snug">Chuyên Viên Đề Xuất Phân Tích Doanh Nghiệp</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Chọn một trong các mô hình kiểm toán dưới thế giới thực được thiết kế riêng cho S-ERP:
          </p>
        </div>

        {/* Suggestion list */}
        <div className="space-y-2.5">
          {promptTemplates.map((tpl, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(tpl.question)}
              disabled={isLoading}
              className="w-full bg-white hover:bg-indigo-50/40 p-3.5 border border-gray-150 rounded-xl hover:border-indigo-200 transition-all text-left flex gap-3 shadow-xs items-start disabled:opacity-50 cursor-pointer group focus:outline-hidden"
            >
              <span className="p-2 bg-slate-55 rounded-lg text-gray-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                {tpl.icon}
              </span>
              <div className="grow">
                <h5 className="text-xs font-bold text-gray-800 group-hover:text-indigo-900 transition-all leading-snug">{tpl.title}</h5>
                <p className="text-[10px] text-gray-400 mt-1 truncate">Chạy đối chiếu thời gian thực</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Center */}
      <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between overflow-hidden" id="ai-chat-console" style={{ height: '70vh' }}>
        
        {/* Chat Console Top Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-slate-50 flex justify-between items-center whitespace-nowrap">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xs animate-pulse">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h4 className="font-bold text-gray-800 text-sm">S-ERP Business Intelligence Panel</h4>
              <p className="text-[10px] text-gray-450 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Sử dụng mô hình gemini-3.5-flash tối tân
              </p>
            </div>
          </div>

          <div className="text-right text-[10px] text-gray-400 bg-white border border-gray-150 px-2 py-1 rounded-md hidden sm:block">
            Mã khoá: <strong className="text-gray-650 font-semibold">GEMINI_API_KEY</strong>
          </div>
        </div>

        {/* Dynamic chat thread bubble viewport */}
        <div className="grow overflow-y-auto p-5 space-y-4 bg-slate-50/20" id="chat-messages-container">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-3 max-w-4xl ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* Avatar for bot */}
              {msg.sender === 'bot' && (
                <span className="h-7 w-7 bg-indigo-150 text-indigo-700 rounded-lg flex items-center justify-center shrink-0 border border-indigo-200">
                  <Bot className="h-4 w-4" />
                </span>
              )}

              {/* Message box */}
              <div className={`rounded-2xl p-4 shadow-2xs leading-relaxed max-w-[85%] ${
                msg.sender === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              }`}>
                {msg.sender === 'user' ? (
                  <p className="text-xs whitespace-pre-wrap font-medium">{msg.text}</p>
                ) : (
                  <div className="space-y-1.5 prose max-w-none">
                    {renderFormattedText(msg.text)}
                  </div>
                )}
                <span className={`text-[9px] block text-right mt-1.5 ${
                  msg.sender === 'user' ? 'text-indigo-200' : 'text-gray-400'
                }`}>
                  {msg.date}
                </span>
              </div>

              {/* Avatar for user */}
              {msg.sender === 'user' && (
                <span className="h-7 w-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 border border-indigo-100 font-bold text-xs uppercase">
                  U
                </span>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-start justify-start animate-pulse">
              <span className="h-7 w-7 bg-indigo-150 text-indigo-700 rounded-lg flex items-center justify-center shrink-0">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none p-4 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-bold mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>Cố vấn AI đang trích xuất dữ liệu, tổng hợp chỉ số tài chính...</span>
                </div>
                <div className="h-2 w-48 bg-slate-100 rounded-full"></div>
                <div className="h-2 w-32 bg-slate-100 rounded-full"></div>
              </div>
            </div>
          )}
        </div>

        {/* Input box form */}
        <div className="p-4 border-t border-gray-100 bg-white" id="ai-chat-input-bar">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Gửi câu hỏi của bạn cho trợ lý: VD 'Mặt hàng nào có giá sỉ cao nhất? Doanh số ra sao?'"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isLoading}
              className="grow bg-slate-50 border border-gray-200 px-4 py-3 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden disabled:opacity-60"
              id="ai-prompt-input-field"
            />
            <button
              type="submit"
              disabled={!userInput.trim() || isLoading}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center shrink-0 focus:outline-hidden"
              id="btn-send-message-to-ai"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </form>
          <div className="text-[10px] text-gray-400 mt-2 text-center">
            Trí tuệ AI có thể lập biểu đồ, so sánh và trực tiếp lấy tên nhân sự hay sản phẩm từ kho để đưa ra lời giải xác thực.
          </div>
        </div>

      </div>

    </div>
  );
};
