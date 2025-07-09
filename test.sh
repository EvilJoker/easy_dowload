#!/bin/bash

# Easy Translate 项目测试脚本
# 使用 uv 运行所有测试用例，包括单元测试和集成测试

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 uv 环境
check_uv() {
    print_info "检查 uv 环境..."
    
    if command -v uv &> /dev/null; then
        print_success "找到 uv"
    else
        print_error "未找到 uv，请先安装: curl -LsSf https://astral.sh/uv/install.sh | sh"
        exit 1
    fi
    
    # 检查项目配置
    if [ ! -f "pyproject.toml" ]; then
        print_error "pyproject.toml 文件不存在"
        exit 1
    fi
    
    print_success "uv 环境检查通过"
}

# 检查项目结构
check_project_structure() {
    print_info "检查项目结构..."
    
    if [ ! -d "tests" ]; then
        print_error "tests 目录不存在"
        exit 1
    fi
    
    if [ ! -d "src" ]; then
        print_error "src 目录不存在"
        exit 1
    fi
    
    print_success "项目结构检查通过"
}

# 清理测试缓存
clean_test_cache() {
    print_info "清理测试缓存..."
    
    if [ -d ".pytest_cache" ]; then
        rm -rf .pytest_cache
        print_success "已清理 .pytest_cache"
    fi
    
    if [ -d "__pycache__" ]; then
        find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        print_success "已清理 __pycache__ 目录"
    fi
    
    if [ -d "htmlcov" ]; then
        rm -rf htmlcov
        print_success "已清理 htmlcov"
    fi
    
    if [ -f ".coverage" ]; then
        rm -f .coverage
        print_success "已清理 .coverage"
    fi
}

# 运行单元测试
run_unit_tests() {
    print_info "运行单元测试..."
    
    if [ ! -d "tests/unit" ]; then
        print_warning "tests/unit 目录不存在，跳过单元测试"
        return
    fi
    
    print_info "发现单元测试目录:"
    find tests/unit -name "test_*.py" -type f | while read -r file; do
        echo "  - $file"
    done
    
    echo ""
    print_info "开始运行单元测试..."
    
    if uv run pytest tests/unit/ -v --tb=short; then
        print_success "单元测试全部通过"
        UNIT_TESTS_PASSED=true
    else
        print_error "单元测试失败"
        UNIT_TESTS_PASSED=false
    fi
}

# 运行集成测试
run_integration_tests() {
    print_info "运行集成测试..."
    
    if [ ! -d "tests/integration" ]; then
        print_warning "tests/integration 目录不存在，跳过集成测试"
        return
    fi
    
    print_info "发现集成测试目录:"
    find tests/integration -name "test_*.py" -type f | while read -r file; do
        echo "  - $file"
    done
    
    echo ""
    print_info "开始运行集成测试..."
    
    if uv run pytest tests/integration/ -v --tb=short; then
        print_success "集成测试全部通过"
        INTEGRATION_TESTS_PASSED=true
    else
        print_error "集成测试失败"
        INTEGRATION_TESTS_PASSED=false
    fi
}

# 运行所有测试
run_all_tests() {
    print_info "运行所有测试..."
    
    if uv run pytest tests/ -v --tb=short; then
        print_success "所有测试全部通过"
        ALL_TESTS_PASSED=true
    else
        print_error "部分测试失败"
        ALL_TESTS_PASSED=false
    fi
}

# 生成测试覆盖率报告
generate_coverage_report() {
    print_info "生成测试覆盖率报告..."
    
    if uv run pytest tests/ --cov=src --cov-report=html --cov-report=term-missing; then
        print_success "覆盖率报告已生成: htmlcov/index.html"
    else
        print_error "生成覆盖率报告失败"
    fi
}

# 运行代码质量检查
run_code_quality_checks() {
    print_info "运行代码质量检查..."
    
    # 代码格式化检查
    print_info "检查代码格式..."
    if uv run black --check src/ tests/; then
        print_success "代码格式检查通过"
    else
        print_warning "代码格式需要调整，运行: uv run black src/ tests/"
    fi
    
    # 导入排序检查
    print_info "检查导入排序..."
    if uv run isort --check-only src/ tests/; then
        print_success "导入排序检查通过"
    else
        print_warning "导入排序需要调整，运行: uv run isort src/ tests/"
    fi
    
    # 代码检查
    print_info "运行代码检查..."
    if uv run ruff check src/ tests/; then
        print_success "代码检查通过"
    else
        print_warning "代码检查发现问题"
    fi
    
    # 类型检查
    print_info "运行类型检查..."
    if uv run mypy src/; then
        print_success "类型检查通过"
    else
        print_warning "类型检查发现问题"
    fi
}

# 生成测试报告
generate_test_report() {
    print_info "生成测试报告..."
    
    local report_file="test_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Easy Translate 项目测试报告"
        echo "生成时间: $(date)"
        echo "=================================="
        echo ""
        
        echo "测试环境:"
        echo "- Python: $(uv run python --version)"
        echo "- uv: $(uv --version)"
        echo ""
        
        echo "测试结果:"
        if [ "$UNIT_TESTS_PASSED" = true ]; then
            echo "- 单元测试: ✅ 通过"
        else
            echo "- 单元测试: ❌ 失败"
        fi
        
        if [ "$INTEGRATION_TESTS_PASSED" = true ]; then
            echo "- 集成测试: ✅ 通过"
        else
            echo "- 集成测试: ❌ 失败"
        fi
        
        echo ""
        echo "测试覆盖率:"
        echo "- 单元测试: $(find tests/unit -name "test_*.py" 2>/dev/null | wc -l) 个测试文件"
        echo "- 集成测试: $(find tests/integration -name "test_*.py" 2>/dev/null | wc -l) 个测试文件"
        
    } > "$report_file"
    
    print_success "测试报告已生成: $report_file"
}

# 显示帮助信息
show_help() {
    echo "Easy Translate 项目测试脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示此帮助信息"
    echo "  -u, --unit              仅运行单元测试"
    echo "  -i, --integration       仅运行集成测试"
    echo "  -a, --all               运行所有测试（默认）"
    echo "  -c, --clean             清理测试缓存"
    echo "  -q, --quality           运行代码质量检查"
    echo "  -r, --report            生成测试报告"
    echo "  -v, --coverage          生成覆盖率报告"
    echo ""
    echo "示例:"
    echo "  $0                      # 运行所有测试"
    echo "  $0 -u                   # 仅运行单元测试"
    echo "  $0 -i                   # 仅运行集成测试"
    echo "  $0 -c                   # 清理缓存"
    echo "  $0 -q                   # 代码质量检查"
    echo "  $0 -r                   # 生成报告"
    echo "  $0 -v                   # 生成覆盖率报告"
}

# 主函数
main() {
    local run_unit=false
    local run_integration=false
    local run_all=true
    local clean_cache=false
    local quality_check=false
    local generate_report=false
    local coverage_report=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -u|--unit)
                run_unit=true
                run_all=false
                shift
                ;;
            -i|--integration)
                run_integration=true
                run_all=false
                shift
                ;;
            -a|--all)
                run_all=true
                shift
                ;;
            -c|--clean)
                clean_cache=true
                shift
                ;;
            -q|--quality)
                quality_check=true
                shift
                ;;
            -r|--report)
                generate_report=true
                shift
                ;;
            -v|--coverage)
                coverage_report=true
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo "=================================="
    echo "Easy Translate 项目测试脚本"
    echo "=================================="
    echo ""
    
    # 检查环境
    check_uv
    check_project_structure
    
    # 清理缓存
    if [ "$clean_cache" = true ]; then
        clean_test_cache
    fi
    
    # 初始化测试结果变量
    UNIT_TESTS_PASSED=false
    INTEGRATION_TESTS_PASSED=false
    ALL_TESTS_PASSED=false
    
    # 运行测试
    if [ "$run_unit" = true ]; then
        run_unit_tests
    fi
    
    if [ "$run_integration" = true ]; then
        run_integration_tests
    fi
    
    if [ "$run_all" = true ]; then
        run_all_tests
    fi
    
    # 运行代码质量检查
    if [ "$quality_check" = true ]; then
        run_code_quality_checks
    fi
    
    # 生成覆盖率报告
    if [ "$coverage_report" = true ]; then
        generate_coverage_report
    fi
    
    # 生成报告
    if [ "$generate_report" = true ]; then
        generate_test_report
    fi
    
    # 显示最终结果
    echo ""
    echo "=================================="
    echo "测试完成"
    echo "=================================="
    
    if [ "$run_all" = true ] && [ "$ALL_TESTS_PASSED" = true ]; then
        print_success "所有测试通过！"
        exit 0
    elif [ "$run_unit" = true ] && [ "$UNIT_TESTS_PASSED" = true ]; then
        print_success "单元测试通过！"
        exit 0
    elif [ "$run_integration" = true ] && [ "$INTEGRATION_TESTS_PASSED" = true ]; then
        print_success "集成测试通过！"
        exit 0
    else
        print_error "部分测试失败"
        exit 1
    fi
}

# 运行主函数
main "$@"