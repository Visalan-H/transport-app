type LoadingSpinnerProps = {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
};

export function LoadingSpinner({ text, size = 'md' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-6 h-6 border-2',
        md: 'w-12 h-12 border-4',
        lg: 'w-16 h-16 border-4',
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3">
            <div className={`${sizeClasses[size]} border-border border-t-primary rounded-full animate-spin`} />
            {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>
    );
}
