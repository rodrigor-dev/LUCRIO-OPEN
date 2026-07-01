"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Shield,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const features = [
  {
    icon: LayoutDashboard,
    title: "Dashboard Inteligente",
    description:
      "Visualize suas finanças em tempo real com gráficos claros e indicadores que realmente importam para o seu negócio.",
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    description:
      "Cadastre e gerencie seus clientes fixos e esporádicos. Acesse histórico completo de serviços e pagamentos.",
  },
  {
    icon: FileText,
    title: "Propostas Comerciais",
    description:
      "Crie propostas profissionais em PDF em minutos e envie diretamente pelo WhatsApp para seus clientes.",
  },
  {
    icon: BarChart3,
    title: "Relatórios Completos",
    description:
      "Gere relatórios detalhados de receitas, despesas e lucros. Exporte dados e tome decisões baseadas em números.",
  },
  {
    icon: Shield,
    title: "Seguro e Confiável",
    description:
      "Seus dados protegidos com criptografia de ponta. Hospedado em servidores seguros com backup automático.",
  },
  {
    icon: Smartphone,
    title: "PWA - Acesse de Qualquer Lugar",
    description:
      "Instale direto no seu celular como um app. Funciona offline e sincroniza quando você volta a ficar online.",
  },
];

const steps = [
  {
    icon: Zap,
    title: "Cadastre-se em segundos",
    description:
      "Crie sua conta gratuitamente em menos de 1 minuto. Sem cartão de crédito, sem burocracia.",
  },
  {
    icon: Sparkles,
    title: "Configure seu perfil",
    description:
      "Adicione seus dados profissionais, serviços e clientes. Tudo personalizado para o seu tipo de atividade.",
  },
  {
    icon: Clock,
    title: "Comece a faturar mais",
    description:
      "Comece a controlar suas finanças, enviar propostas e acompanhar seus resultados diariamente.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-1">
            <Sparkles className="h-6 w-6 text-emerald-500" />
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              LUCRIO
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900">
                Login
              </Button>
            </Link>
            <Link href="/cadastro">
              <Button className="bg-emerald-500 text-white hover:bg-emerald-600">
                Comece Grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/80 via-white to-white px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-emerald-100/40 blur-3xl" />
          <div className="absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-emerald-50/60 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative mx-auto max-w-4xl text-center"
        >
          <Badge
            variant="secondary"
            className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Feito para prestadores de serviços
          </Badge>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Controle Financeiro
            <br />
            <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
              Inteligente
            </span>{" "}
            para Prestadores de Serviços
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-500 sm:text-xl">
            Gerencie suas receitas, despesas, clientes e propostas comerciais em
            um só lugar. Feito para eletricistas, encanadores, designers,
            fotógrafos e todos os profissionais autônomos.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/cadastro">
              <Button
                size="lg"
                className="gap-2 bg-emerald-500 px-8 text-base text-white hover:bg-emerald-600"
              >
                Comece Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="lg"
                className="border-slate-200 px-8 text-base text-slate-700 hover:bg-slate-50"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <Badge
              variant="outline"
              className="mb-4 border-emerald-200 text-emerald-600"
            >
              Funcionalidades
            </Badge>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-500">
              Ferramentas poderosas e simples de usar, projetadas
              especificamente para quem trabalha por conta própria.
            </p>
          </motion.div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={itemVariants}>
                <Card className="group h-full cursor-default border-slate-100 transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50">
                  <CardHeader>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 transition-colors duration-300 group-hover:bg-emerald-100">
                      <feature.icon className="h-6 w-6 text-emerald-500" />
                    </div>
                    <CardTitle className="text-lg text-slate-900">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed text-slate-500">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <Badge
              variant="outline"
              className="mb-4 border-emerald-200 text-emerald-600"
            >
              Como funciona
            </Badge>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Simples de começar, poderoso de usar
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-500">
              Em apenas 3 passos simples, você começa a transformar a gestão do
              seu negócio.
            </p>
          </motion.div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid gap-8 sm:grid-cols-3"
          >
            {steps.map((step, index) => (
              <motion.div key={step.title} variants={itemVariants}>
                <div className="relative">
                  {index < steps.length - 1 && (
                    <div className="absolute right-0 top-8 hidden h-[2px] w-full translate-x-1/2 bg-emerald-200 sm:block" />
                  )}
                  <Card className="relative border-slate-100 bg-white text-center transition-all duration-300 hover:shadow-lg hover:shadow-emerald-50">
                    <CardHeader>
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                        <step.icon className="h-8 w-8" />
                      </div>
                      <div className="mb-2 text-sm font-bold text-emerald-500">
                        Passo {index + 1}
                      </div>
                      <CardTitle className="text-lg text-slate-900">
                        {step.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed text-slate-500">
                        {step.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <Badge
              variant="outline"
              className="mb-4 border-emerald-200 text-emerald-600"
            >
              Preços
            </Badge>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Planos simples e transparentes
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-500">
              Comece grátis e escale conforme seu negócio cresce.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto max-w-md"
          >
            <Card className="relative overflow-hidden border-2 border-emerald-200 shadow-xl shadow-emerald-100/50">
              <div className="absolute right-4 top-4">
                <Badge className="bg-emerald-500 text-white">Popular</Badge>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-xl text-slate-900">
                  Plano Básico
                </CardTitle>
                <CardDescription>
                  Tudo que você precisa para começar
                </CardDescription>
                <div className="mt-4">
                  <span className="text-5xl font-bold text-slate-900">
                    R$ 29,90
                  </span>
                  <span className="text-slate-500">/mês</span>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {[
                    "Dashboard financeiro completo",
                    "Gestão de clientes ilimitada",
                    "Propostas comerciais em PDF",
                    "Relatórios detalhados",
                    "Acesso via PWA no celular",
                    "Suporte por e-mail",
                    "Atualizações gratuitas",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/cadastro" className="w-full">
                  <Button
                    size="lg"
                    className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    Comece agora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-20 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Pronto para transformar suas finanças?
          </h2>
          <p className="mb-8 text-lg text-emerald-100">
            Comece agora gratuitamente e descubra como é fácil controlar o
            financeiro do seu negócio.
          </p>
          <Link href="/cadastro">
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 bg-white px-8 text-base text-emerald-600 hover:bg-emerald-50"
            >
              Comece Grátis Agora
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-1">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              <span className="text-lg font-bold text-slate-900">LUCRIO</span>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} LUCRIO. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
