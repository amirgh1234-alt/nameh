import React, { useState, useEffect } from 'react';
import { generateDocument, reviseDocument } from './services/geminiService';
import { DocumentType, GenerationState, HistoryItem, SavedData, DocumentInputs } from './types';
import { 
  PenIcon, FileTextIcon, UsersIcon, CopyIcon, CheckIcon, TrashIcon, 
  MessageIcon, RefreshIcon, XIcon, UndoIcon, DownloadIcon, SaveIcon, PlusIcon
} from './components/Icons';

const App: React.FC = () => {
  // Input States
  const [inputs, setInputs] = useState<DocumentInputs>({
    recipientName: '',
    recipientRole: '',
    subject: '',
    body: ''
  });

  // Saved Data State
  const [savedData, setSavedData] = useState<SavedData>({
    recipients: [],
    subjects: []
  });

  // Generation State
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    results: [],
    selectedIndex: 0,
    type: null,
  });

  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Revision State
  const [feedbackText, setFeedbackText] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [previousVersion, setPreviousVersion] = useState<string | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  // Load data from local storage
  useEffect(() => {
    const savedHist = localStorage.getItem('nevisandeh_history');
    const savedUserItems = localStorage.getItem('nevisandeh_saved_items');
    
    if (savedHist) {
      try { setHistory(JSON.parse(savedHist)); } catch (e) { console.error("Failed to parse history"); }
    }
    if (savedUserItems) {
      try { setSavedData(JSON.parse(savedUserItems)); } catch (e) { console.error("Failed to parse saved items"); }
    }
  }, []);

  // Persist data
  useEffect(() => {
    localStorage.setItem('nevisandeh_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('nevisandeh_saved_items', JSON.stringify(savedData));
  }, [savedData]);

  const addToHistory = (original: string, generated: string, type: DocumentType) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      originalText: original,
      generatedText: generated,
      type: type,
      timestamp: Date.now()
    };
    setHistory(prev => [newItem, ...prev].slice(0, 10));
  };

  const handleInputChange = (field: keyof DocumentInputs, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const saveItem = (type: 'recipients' | 'subjects', value: string) => {
    if (!value.trim() || savedData[type].includes(value.trim())) return;
    setSavedData(prev => ({
      ...prev,
      [type]: [...prev[type], value.trim()]
    }));
  };

  const removeItem = (type: 'recipients' | 'subjects', value: string) => {
    setSavedData(prev => ({
      ...prev,
      [type]: prev[type].filter(item => item !== value)
    }));
  };

  const handleGenerate = async (type: DocumentType) => {
    if (!inputs.body.trim() && !inputs.subject.trim()) return;

    // Reset revision
    setPreviousVersion(null);
    setShowFeedbackInput(false);
    setFeedbackText('');

    setState({ isLoading: true, error: null, results: [], selectedIndex: 0, type });

    try {
      const results = await generateDocument(inputs, type);
      setState({ isLoading: false, error: null, results, selectedIndex: 0, type });
      
      const summaryText = inputs.subject || inputs.body.substring(0, 50) + "...";
      addToHistory(summaryText, results[0], type);
    } catch (err: any) {
      setState({ 
        isLoading: false, 
        error: err.message || 'خطایی رخ داده است', 
        results: [], 
        selectedIndex: 0, 
        type: null 
      });
    }
  };

  const getCurrentResult = () => {
    if (state.results.length === 0) return null;
    return state.results[state.selectedIndex];
  };

  const updateCurrentResult = (newText: string) => {
    const newResults = [...state.results];
    newResults[state.selectedIndex] = newText;
    setState(prev => ({ ...prev, results: newResults }));
  };

  const handleRevise = async () => {
    const current = getCurrentResult();
    if (!current || !state.type || !feedbackText.trim()) return;

    setIsRevising(true);
    setPreviousVersion(current);

    try {
      const revisedResult = await reviseDocument(current, feedbackText, state.type);
      updateCurrentResult(revisedResult);
      setFeedbackText('');
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || 'خطا در ویرایش متن' }));
    } finally {
      setIsRevising(false);
    }
  };

  const handleAcceptRevision = () => {
    setPreviousVersion(null);
    setShowFeedbackInput(false);
    setFeedbackText('');
  };

  const handleDiscardRevision = () => {
    if (previousVersion) {
      updateCurrentResult(previousVersion);
      setPreviousVersion(null);
      setFeedbackText('');
    }
  };

  const handleCopy = () => {
    const current = getCurrentResult();
    if (current) {
      navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadWord = () => {
    const current = getCurrentResult();
    if (!current) return;

    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Document</title></head><body>";
    const footer = "</body></html>";
    // Convert newlines to breaks for HTML rendering in Word
    const htmlContent = header + `<div style="font-family: 'Vazirmatn', 'Arial', sans-serif; direction: rtl; text-align: justify; line-height: 1.6; white-space: pre-wrap;">${current}</div>` + footer;
    
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    
    // Native download implementation
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.type === DocumentType.LETTER ? 'Letter.doc' : 'Minutes.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setInputs({
      recipientName: '',
      recipientRole: '',
      subject: '',
      body: item.originalText // Note: original inputs aren't fully reconstructed, just the text
    });
    setState({
      isLoading: false,
      error: null,
      results: [item.generatedText],
      selectedIndex: 0,
      type: item.type
    });
    setPreviousVersion(null);
    setShowFeedbackInput(false);
  };

  const isFormValid = inputs.body.trim().length > 0 || inputs.subject.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar / History */}
      <aside className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col h-auto md:h-screen md:sticky md:top-0 order-2 md:order-1 shadow-sm z-10">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-700">تاریخچه نگارش</h2>
          {history.length > 0 && (
            <button 
              onClick={() => setHistory([])}
              className="text-red-500 hover:text-red-700 p-1 transition-colors"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-slate-400 py-10 text-sm">
              هنوز متنی پردازش نشده است.
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-primary-500 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.type === DocumentType.LETTER 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {item.type === DocumentType.LETTER ? 'نامه' : 'صورتجلسه'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {item.originalText}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 flex flex-col max-w-6xl mx-auto w-full order-1 md:order-2">
        <header className="mb-8 text-center md:text-right">
          <div className="inline-flex items-center gap-2 mb-2 bg-primary-50 px-3 py-1 rounded-full text-primary-700 border border-primary-100">
            <PenIcon />
            <span className="text-sm font-semibold">دستیار هوشمند نگارش اداری</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
            نگارش <span className="text-primary-600">هوشمند</span> اسناد
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          
          {/* Input Section */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Structured Inputs Container */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
               
               {/* Recipient Field */}
               <div className="relative">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">نام گیرنده نامه</label>
                  <div className="flex gap-2">
                    <input 
                      list="saved-recipients"
                      value={inputs.recipientName}
                      onChange={(e) => handleInputChange('recipientName', e.target.value)}
                      placeholder="مثال: جناب آقای دکتر محمدی"
                      className="flex-1 p-2 rounded-lg border border-slate-300 focus:border-primary-500 outline-none text-sm"
                    />
                    <button 
                       onClick={() => saveItem('recipients', inputs.recipientName)}
                       className="p-2 text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                       title="افزودن به لیست ذخیره"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                  <datalist id="saved-recipients">
                    {savedData.recipients.map((item, i) => <option key={i} value={item} />)}
                  </datalist>
               </div>

               {/* Recipient Role Field */}
               <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">سمت گیرنده</label>
                  <input 
                    value={inputs.recipientRole}
                    onChange={(e) => handleInputChange('recipientRole', e.target.value)}
                    placeholder="مثال: مدیر محترم عامل شرکت..."
                    className="w-full p-2 rounded-lg border border-slate-300 focus:border-primary-500 outline-none text-sm"
                  />
               </div>

               {/* Subject Field */}
               <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">موضوع</label>
                  <div className="flex gap-2">
                    <input 
                      list="saved-subjects"
                      value={inputs.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="مثال: درخواست مرخصی / گزارش عملکرد"
                      className="flex-1 p-2 rounded-lg border border-slate-300 focus:border-primary-500 outline-none text-sm"
                    />
                    <button 
                       onClick={() => saveItem('subjects', inputs.subject)}
                       className="p-2 text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                       title="افزودن به لیست ذخیره"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                   <datalist id="saved-subjects">
                    {savedData.subjects.map((item, i) => <option key={i} value={item} />)}
                  </datalist>
               </div>
            </div>

            {/* Main Body Textarea */}
            <div className="relative flex-1 min-h-[200px]">
              <textarea
                className="w-full h-full p-4 rounded-2xl border border-slate-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 resize-none outline-none transition-all text-base leading-loose shadow-sm placeholder:text-slate-400"
                placeholder="توضیحات اصلی یا متن خام خود را اینجا بنویسید...
مثال: لطفاً دستور دهید لامپ‌های راهرو تعویض شود."
                value={inputs.body}
                onChange={(e) => handleInputChange('body', e.target.value)}
                disabled={state.isLoading || isRevising}
                maxLength={10000}
              />
              <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-white/80 px-2 rounded pointer-events-none">
                {inputs.body.length} / 10000
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleGenerate(DocumentType.LETTER)}
                disabled={state.isLoading || isRevising || !isFormValid}
                className="flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="bg-blue-100 p-1.5 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <FileTextIcon />
                </div>
                <span>تولید نامه رسمی</span>
              </button>

              <button
                onClick={() => handleGenerate(DocumentType.MINUTES)}
                disabled={state.isLoading || isRevising || !isFormValid}
                className="flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="bg-emerald-100 p-1.5 rounded-lg group-hover:bg-emerald-200 transition-colors">
                  <UsersIcon />
                </div>
                <span>تهیه صورتجلسه</span>
              </button>
            </div>
            
            {state.error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm">
                خطا: {state.error}
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className={`lg:col-span-7 relative flex flex-col rounded-2xl border ${state.results.length > 0 ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-50 border-dashed border-slate-300'} transition-all min-h-[500px]`}>
            
            {state.isLoading || isRevising ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-2xl z-10 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium animate-pulse">
                  {isRevising ? 'در حال اعمال اصلاحات...' : 'در حال نگارش (تهیه چند نمونه)...'}
                </p>
              </div>
            ) : null}

            {state.results.length === 0 && !state.isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <FileTextIcon />
                </div>
                <p className="font-medium">منتظر ورود اطلاعات...</p>
                <p className="text-sm mt-2 opacity-70">پس از ورود اطلاعات و زدن دکمه تولید، چند نمونه متن برای شما آماده می‌شود.</p>
              </div>
            )}

            {state.results.length > 0 && (
              <>
                {/* Header / Tabs */}
                <div className="flex flex-col border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                  {/* Variation Tabs */}
                  {state.results.length > 1 && (
                     <div className="flex px-4 pt-4 gap-2">
                        {state.results.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setState(prev => ({ ...prev, selectedIndex: idx }))}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                              state.selectedIndex === idx 
                                ? 'bg-white border-t border-r border-l border-slate-200 text-primary-600 -mb-px relative z-10' 
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                             نمونه {idx + 1}
                          </button>
                        ))}
                     </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between p-3 px-4 bg-white/50">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${state.type === DocumentType.LETTER ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                      <span className="text-sm font-bold text-slate-700">
                         {state.type === DocumentType.LETTER ? 'پیش‌نویس نامه' : 'پیش‌نویس صورتجلسه'}
                      </span>
                      {previousVersion && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mr-2">
                          در حال بازبینی
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-all"
                      >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                        {copied ? 'کپی شد' : 'کپی'}
                      </button>
                      <button
                        onClick={handleDownloadWord}
                        className="flex items-center gap-1.5 text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <DownloadIcon />
                        دانلود Word
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[600px] leading-8 text-justify whitespace-pre-wrap text-slate-800 font-medium bg-white">
                  {getCurrentResult()}
                </div>

                {/* Revision / Feedback Area */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                  {!showFeedbackInput && !previousVersion ? (
                    <button 
                      onClick={() => setShowFeedbackInput(true)}
                      className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-primary-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
                    >
                      <MessageIcon />
                      درخواست اصلاح یا تغییر متن
                    </button>
                  ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {previousVersion ? (
                        <div className="flex gap-2">
                          <button
                            onClick={handleAcceptRevision}
                            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            <CheckIcon />
                            تایید تغییرات
                          </button>
                          <button
                            onClick={handleDiscardRevision}
                            className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            <UndoIcon />
                            بازگشت به نسخه قبل
                          </button>
                        </div>
                      ) : (
                        <>
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="چه تغییری در متن ایجاد شود؟ (مثلاً: کمی کوتاه‌تر کن، بند مربوط به تاریخ را حذف کن...)"
                            className="w-full p-3 text-sm rounded-lg border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none resize-none h-20"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleRevise}
                              disabled={!feedbackText.trim()}
                              className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshIcon />
                              اعمال تغییرات
                            </button>
                            <button
                              onClick={() => {
                                setShowFeedbackInput(false);
                                setFeedbackText('');
                              }}
                              className="w-10 flex items-center justify-center bg-white border border-slate-300 text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
                            >
                              <XIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
