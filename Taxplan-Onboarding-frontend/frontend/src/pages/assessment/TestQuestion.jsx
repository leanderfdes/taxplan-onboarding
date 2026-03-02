export default function TestQuestion({ question, selectedAnswer, onSelectAnswer, questionIndex, totalQuestions }) {

    const optionEntries = question.options ? Object.entries(question.options) : [];

    return (
        <div>
            {/* Question header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: 12, fontWeight: 700, color: '#059669', background: '#ecfdf5',
                    padding: '5px 14px', borderRadius: 20,
                }}>
                    Q{questionIndex + 1} / {totalQuestions}
                </span>
                {question.domain && (
                    <span style={{
                        fontSize: 12, fontWeight: 600, color: '#6366f1', background: '#eef2ff',
                        padding: '5px 14px', borderRadius: 20,
                    }}>
                        {question.domain}
                    </span>
                )}
            </div>

            {/* Question text */}
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.5, marginBottom: 28, margin: '0 0 28px' }}>
                {question.question}
            </h2>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {optionEntries.map(([key, value]) => {
                    const isSelected = selectedAnswer === key;
                    return (
                        <button
                            key={key}
                            onClick={() => onSelectAnswer(key)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                                padding: '16px 20px', borderRadius: 12, textAlign: 'left',
                                border: isSelected ? '2px solid #059669' : '2px solid #e5e7eb',
                                background: isSelected ? '#f0fdf4' : '#fff',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 700,
                                background: isSelected ? '#059669' : '#f3f4f6',
                                color: isSelected ? '#fff' : '#6b7280',
                            }}>
                                {isSelected ? '✓' : key}
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 500, color: isSelected ? '#111827' : '#374151', lineHeight: 1.5 }}>
                                {value}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
