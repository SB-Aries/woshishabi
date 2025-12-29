import React, { createContext, useContext } from 'react';

// 创建认证上下文
const AuthContext = createContext(null);

// 自定义Hook，方便在组件中使用认证上下文
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
